import { Pool as PgPool } from 'pg';
import { createPool as createMySqlPool, Pool as MySqlPool } from 'mysql2/promise';
import { Connection as TediousConnection, Request, TYPES } from 'tedious';
import { prisma } from '../lib/prisma.js';
import { createChildLogger } from '../utils/logger.js';
import { NotFoundError, ValidationError, AppError } from '../middleware/errorHandler.js';
import { catalogService } from './catalog.service.js';
import type {
  DataConnection,
  CreateConnection,
  ConnectionTestResult,
  SourceSchema,
  DatabaseSchema,
  TableSchema,
  ColumnSchema,
  ConnectionType,
} from '../models/index.js';
import crypto from 'crypto';

const logger = createChildLogger('DataConnectorService');

// Simple encryption for credentials (in production, use a proper key management solution)
const ENCRYPTION_KEY = process.env['ENCRYPTION_KEY'] ?? 'default-key-change-in-production!';
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

export class DataConnectorService {
  /**
   * Create a new data connection
   */
  async createConnection(data: CreateConnection): Promise<DataConnection> {
    logger.debug({ name: data.name, type: data.connectionType }, 'Creating connection');

    let encryptedPassword: string | undefined;
    if (data.password) {
      encryptedPassword = this.encryptPassword(data.password);
    }

    const connection = await prisma.dataConnection.create({
      data: {
        name: data.name,
        description: data.description,
        connectionType: data.connectionType,
        host: data.host,
        port: data.port,
        database: data.database,
        username: data.username,
        encryptedPassword,
        additionalConfig: data.additionalConfig ?? {},
      },
    });

    logger.info({ connectionId: connection.id }, 'Connection created');

    return this.mapConnection(connection);
  }

  /**
   * Get a connection by ID
   */
  async getConnection(connectionId: string): Promise<DataConnection> {
    const connection = await prisma.dataConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new NotFoundError('Connection', connectionId);
    }

    return this.mapConnection(connection);
  }

  /**
   * List all connections
   */
  async listConnections(): Promise<DataConnection[]> {
    const connections = await prisma.dataConnection.findMany({
      orderBy: { name: 'asc' },
    });

    return connections.map(c => this.mapConnection(c));
  }

  /**
   * Test a connection
   */
  async testConnection(connectionId: string): Promise<ConnectionTestResult> {
    const connection = await prisma.dataConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new NotFoundError('Connection', connectionId);
    }

    const password = connection.encryptedPassword
      ? this.decryptPassword(connection.encryptedPassword)
      : undefined;

    const startTime = Date.now();
    let result: ConnectionTestResult;

    try {
      switch (connection.connectionType) {
        case 'POSTGRESQL':
          result = await this.testPostgresConnection(connection, password);
          break;
        case 'MYSQL':
          result = await this.testMySqlConnection(connection, password);
          break;
        case 'SQLSERVER':
          result = await this.testSqlServerConnection(connection, password);
          break;
        default:
          throw new ValidationError(`Unsupported connection type: ${connection.connectionType}`);
      }

      result.latencyMs = Date.now() - startTime;
    } catch (error) {
      result = {
        success: false,
        message: 'Connection failed',
        error: (error as Error).message,
        latencyMs: Date.now() - startTime,
      };
    }

    // Update connection test status
    await prisma.dataConnection.update({
      where: { id: connectionId },
      data: {
        lastTestedAt: new Date(),
        lastTestSuccess: result.success,
      },
    });

    return result;
  }

  /**
   * Explore the schema of a data source
   */
  async exploreSource(connectionId: string): Promise<SourceSchema> {
    const connection = await prisma.dataConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new NotFoundError('Connection', connectionId);
    }

    const password = connection.encryptedPassword
      ? this.decryptPassword(connection.encryptedPassword)
      : undefined;

    switch (connection.connectionType) {
      case 'POSTGRESQL':
        return this.explorePostgresSchema(connection, password);
      case 'MYSQL':
        return this.exploreMySqlSchema(connection, password);
      case 'SQLSERVER':
        return this.exploreSqlServerSchema(connection, password);
      default:
        throw new ValidationError(`Unsupported connection type: ${connection.connectionType}`);
    }
  }

  /**
   * Extract metadata and create assets from a data source
   */
  async extractMetadata(
    connectionId: string,
    userId: string,
    incremental: boolean = false
  ): Promise<{ assetsCreated: number; assetsUpdated: number }> {
    const connection = await prisma.dataConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new NotFoundError('Connection', connectionId);
    }

    const schema = await this.exploreSource(connectionId);
    let assetsCreated = 0;
    let assetsUpdated = 0;

    for (const database of schema.databases) {
      for (const table of database.tables) {
        const fullName = table.schema
          ? `${database.name}.${table.schema}.${table.name}`
          : `${database.name}.${table.name}`;

        // Check if asset already exists
        const existingAsset = await prisma.connectionAsset.findFirst({
          where: {
            connectionId,
            sourcePath: fullName,
          },
          include: { asset: true },
        });

        if (existingAsset) {
          if (incremental) continue;
          // Update existing asset
          await catalogService.updateAsset(
            existingAsset.assetId,
            { description: `Table from ${connection.name}` },
            userId
          );
          assetsUpdated++;
        } else {
          // Create new asset
          const asset = await catalogService.createAsset(
            {
              name: fullName,
              description: `Table from ${connection.name}`,
              assetType: 'TABLE',
              domain: database.name,
              tags: [connection.connectionType.toLowerCase()],
            },
            userId
          );

          // Register schema
          await catalogService.registerSchema(
            asset.id,
            {
              schemaFormat: 'JSON_SCHEMA',
              schemaDefinition: {
                type: 'object',
                properties: table.columns.reduce(
                  (acc, col) => ({
                    ...acc,
                    [col.name]: {
                      type: this.mapSqlTypeToJsonType(col.dataType),
                      nullable: col.nullable,
                    },
                  }),
                  {}
                ),
              },
            },
            userId
          );

          // Link asset to connection
          await prisma.connectionAsset.create({
            data: {
              connectionId,
              assetId: asset.id,
              sourcePath: fullName,
              lastSyncedAt: new Date(),
            },
          });

          assetsCreated++;
        }
      }
    }

    logger.info({ connectionId, assetsCreated, assetsUpdated }, 'Metadata extracted');

    return { assetsCreated, assetsUpdated };
  }

  // =====================
  // PostgreSQL Methods
  // =====================

  private async testPostgresConnection(
    connection: { host: string; port: number; database: string | null; username: string | null },
    password?: string
  ): Promise<ConnectionTestResult> {
    const pool = new PgPool({
      host: connection.host,
      port: connection.port,
      database: connection.database ?? 'postgres',
      user: connection.username ?? undefined,
      password,
      connectionTimeoutMillis: 5000,
    });

    try {
      const result = await pool.query('SELECT 1');
      return { success: true, message: 'Connection successful' };
    } finally {
      await pool.end();
    }
  }

  private async explorePostgresSchema(
    connection: { host: string; port: number; database: string | null; username: string | null },
    password?: string
  ): Promise<SourceSchema> {
    const pool = new PgPool({
      host: connection.host,
      port: connection.port,
      database: connection.database ?? 'postgres',
      user: connection.username ?? undefined,
      password,
    });

    try {
      const tablesQuery = `
        SELECT 
          table_catalog as database,
          table_schema as schema,
          table_name as table
        FROM information_schema.tables
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        AND table_type = 'BASE TABLE'
        ORDER BY table_schema, table_name
      `;

      const columnsQuery = `
        SELECT 
          table_schema as schema,
          table_name as table,
          column_name as column,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        ORDER BY table_schema, table_name, ordinal_position
      `;

      const [tablesResult, columnsResult] = await Promise.all([
        pool.query(tablesQuery),
        pool.query(columnsQuery),
      ]);

      const databaseMap = new Map<string, DatabaseSchema>();

      for (const row of tablesResult.rows) {
        const dbName = row.database;
        if (!databaseMap.has(dbName)) {
          databaseMap.set(dbName, { name: dbName, tables: [] });
        }

        const db = databaseMap.get(dbName)!;
        const tableKey = `${row.schema}.${row.table}`;

        const columns = columnsResult.rows
          .filter(c => c.schema === row.schema && c.table === row.table)
          .map(c => ({
            name: c.column,
            dataType: c.data_type,
            nullable: c.is_nullable === 'YES',
            primaryKey: false,
            defaultValue: c.column_default,
          }));

        db.tables.push({
          name: row.table,
          schema: row.schema,
          columns,
        });
      }

      return { databases: Array.from(databaseMap.values()) };
    } finally {
      await pool.end();
    }
  }

  // =====================
  // MySQL Methods
  // =====================

  private async testMySqlConnection(
    connection: { host: string; port: number; database: string | null; username: string | null },
    password?: string
  ): Promise<ConnectionTestResult> {
    const pool = await createMySqlPool({
      host: connection.host,
      port: connection.port,
      database: connection.database ?? undefined,
      user: connection.username ?? undefined,
      password,
      connectionLimit: 1,
      connectTimeout: 5000,
    });

    try {
      await pool.query('SELECT 1');
      return { success: true, message: 'Connection successful' };
    } finally {
      await pool.end();
    }
  }

  private async exploreMySqlSchema(
    connection: { host: string; port: number; database: string | null; username: string | null },
    password?: string
  ): Promise<SourceSchema> {
    const pool = await createMySqlPool({
      host: connection.host,
      port: connection.port,
      database: connection.database ?? undefined,
      user: connection.username ?? undefined,
      password,
    });

    try {
      const [tables] = await pool.query<any[]>(`
        SELECT 
          TABLE_SCHEMA as db,
          TABLE_NAME as tbl
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys')
        AND TABLE_TYPE = 'BASE TABLE'
      `);

      const [columns] = await pool.query<any[]>(`
        SELECT 
          TABLE_SCHEMA as db,
          TABLE_NAME as tbl,
          COLUMN_NAME as col,
          DATA_TYPE as dtype,
          IS_NULLABLE as nullable,
          COLUMN_DEFAULT as def
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys')
      `);

      const databaseMap = new Map<string, DatabaseSchema>();

      for (const row of tables) {
        if (!databaseMap.has(row.db)) {
          databaseMap.set(row.db, { name: row.db, tables: [] });
        }

        const db = databaseMap.get(row.db)!;
        const tableCols = columns
          .filter(c => c.db === row.db && c.tbl === row.tbl)
          .map(c => ({
            name: c.col,
            dataType: c.dtype,
            nullable: c.nullable === 'YES',
            primaryKey: false,
            defaultValue: c.def,
          }));

        db.tables.push({
          name: row.tbl,
          columns: tableCols,
        });
      }

      return { databases: Array.from(databaseMap.values()) };
    } finally {
      await pool.end();
    }
  }

  // =====================
  // SQL Server Methods
  // =====================

  private async testSqlServerConnection(
    connection: { host: string; port: number; database: string | null; username: string | null },
    password?: string
  ): Promise<ConnectionTestResult> {
    return new Promise((resolve, reject) => {
      const tediousConnection = new TediousConnection({
        server: connection.host,
        options: {
          port: connection.port,
          database: connection.database ?? undefined,
          trustServerCertificate: true,
          connectTimeout: 5000,
        },
        authentication: {
          type: 'default',
          options: {
            userName: connection.username ?? undefined,
            password,
          },
        },
      });

      tediousConnection.on('connect', err => {
        if (err) {
          resolve({ success: false, message: 'Connection failed', error: err.message });
        } else {
          tediousConnection.close();
          resolve({ success: true, message: 'Connection successful' });
        }
      });

      tediousConnection.connect();
    });
  }

  private async exploreSqlServerSchema(
    connection: { host: string; port: number; database: string | null; username: string | null },
    password?: string
  ): Promise<SourceSchema> {
    // Simplified implementation - return empty for now
    return { databases: [] };
  }

  // =====================
  // Helper Methods
  // =====================

  private encryptPassword(password: string): string {
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  private decryptPassword(encryptedPassword: string): string {
    const parts = encryptedPassword.split(':');
    if (parts.length !== 3) {
      throw new AppError('Invalid encrypted password format');
    }

    const [ivHex, authTagHex, encrypted] = parts;
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const iv = Buffer.from(ivHex!, 'hex');
    const authTag = Buffer.from(authTagHex!, 'hex');

    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted!, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  private mapSqlTypeToJsonType(sqlType: string): string {
    const type = sqlType.toLowerCase();

    if (type.includes('int') || type.includes('serial')) return 'integer';
    if (type.includes('numeric') || type.includes('decimal') || type.includes('float') || type.includes('double')) return 'number';
    if (type.includes('bool')) return 'boolean';
    if (type.includes('json')) return 'object';
    if (type.includes('array')) return 'array';

    return 'string';
  }

  private mapConnection(connection: {
    id: string;
    name: string;
    description: string | null;
    connectionType: string;
    host: string;
    port: number;
    database: string | null;
    username: string | null;
    isActive: boolean;
    lastTestedAt: Date | null;
    lastTestSuccess: boolean | null;
    createdAt: Date;
    updatedAt: Date;
  }): DataConnection {
    return {
      id: connection.id,
      name: connection.name,
      description: connection.description ?? undefined,
      connectionType: connection.connectionType as ConnectionType,
      host: connection.host,
      port: connection.port,
      database: connection.database ?? undefined,
      username: connection.username ?? undefined,
      isActive: connection.isActive,
      lastTestedAt: connection.lastTestedAt ?? undefined,
      lastTestSuccess: connection.lastTestSuccess ?? undefined,
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt,
    };
  }
}

export const dataConnectorService = new DataConnectorService();
