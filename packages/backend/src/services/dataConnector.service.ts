import { Pool as PgPool } from 'pg';
import { createPool as createMySqlPool, Pool as MySqlPool } from 'mysql2/promise';
import { Connection as TediousConnection, Request } from 'tedious';
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

type SampleMode = 'FIRST_N' | 'RANDOM_N';

interface TableSampleInput {
  database: string;
  schema?: string;
  table: string;
  sampleMode: SampleMode;
  limit: number;
}

interface TableSampleResult {
  database: string;
  schema?: string;
  table: string;
  dialect: 'POSTGRESQL' | 'MYSQL';
  sqlPreview: string;
  sampleMode: SampleMode;
  limit: number;
  returnedRows: number;
  columns: string[];
  rows: Array<Record<string, unknown>>;
}

export class DataConnectorService {
  /**
   * Test connection parameters without persisting a connection
   */
  async testConnectionConfig(data: CreateConnection): Promise<ConnectionTestResult> {
    const startTime = Date.now();

    let result: ConnectionTestResult;

    try {
      const connection = {
        host: data.host,
        port: data.port,
        database: data.database ?? null,
        username: data.username ?? null,
      };

      switch (data.connectionType) {
        case 'POSTGRESQL':
          result = await this.testPostgresConnection(connection, data.password);
          break;
        case 'MYSQL':
          result = await this.testMySqlConnection(connection, data.password);
          break;
        case 'SQLSERVER':
          result = await this.testSqlServerConnection(connection, data.password);
          break;
        default:
          throw new ValidationError(`Unsupported connection type: ${data.connectionType}`);
      }

      result.latencyMs = Date.now() - startTime;
      return result;
    } catch (error) {
      return {
        success: false,
        message: 'Connection failed',
        error: (error as Error).message,
        latencyMs: Date.now() - startTime,
      };
    }
  }

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
   * Update a connection
   */
  async updateConnection(connectionId: string, data: any): Promise<DataConnection> {
    const connection = await prisma.dataConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new NotFoundError('Connection', connectionId);
    }

    let encryptedPassword: string | undefined = connection.encryptedPassword;
    if (data.password) {
      encryptedPassword = this.encryptPassword(data.password);
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.connectionType !== undefined) updateData.connectionType = data.connectionType;
    if (data.host !== undefined) updateData.host = data.host;
    if (data.port !== undefined) updateData.port = data.port;
    if (data.database !== undefined) updateData.database = data.database;
    if (data.username !== undefined) updateData.username = data.username;
    if (encryptedPassword !== undefined) updateData.encryptedPassword = encryptedPassword;
    if (data.additionalConfig !== undefined) updateData.additionalConfig = data.additionalConfig;

    const updated = await prisma.dataConnection.update({
      where: { id: connectionId },
      data: updateData,
    });

    logger.info({ connectionId }, 'Connection updated');

    return this.mapConnection(updated);
  }

  /**
   * Delete a connection
   */
  async deleteConnection(connectionId: string): Promise<void> {
    const connection = await prisma.dataConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new NotFoundError('Connection', connectionId);
    }

    // Delete any linked assets
    await prisma.connectionAsset.deleteMany({
      where: { connectionId },
    });

    await prisma.dataConnection.delete({
      where: { id: connectionId },
    });

    logger.info({ connectionId }, 'Connection deleted');
  }

  /**
   * List all connections
   */
  async listConnections(): Promise<DataConnection[]> {
    const connections = await prisma.dataConnection.findMany({
      orderBy: { name: 'asc' },
    });

    return connections.map((connection: any) => this.mapConnection(connection));
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

    let schema: SourceSchema;

    try {
      switch (connection.connectionType) {
        case 'POSTGRESQL':
          schema = await this.explorePostgresSchema(connection, password);
          break;
        case 'MYSQL':
          schema = await this.exploreMySqlSchema(connection, password);
          break;
        case 'SQLSERVER':
          schema = await this.exploreSqlServerSchema(connection, password);
          break;
        default:
          throw new ValidationError(`Unsupported connection type: ${connection.connectionType}`);
      }

      // Record this schema exploration
      await this.recordSchemaExploration(connectionId, schema);

      return schema;
    } catch (error) {
      throw error;
    }
  }

  async sampleTableData(connectionId: string, input: TableSampleInput): Promise<TableSampleResult> {
    const connection = await prisma.dataConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new NotFoundError('Connection', connectionId);
    }

    const safeLimit = Math.min(Math.max(input.limit, 1), 5000);
    const password = connection.encryptedPassword
      ? this.decryptPassword(connection.encryptedPassword)
      : undefined;

    if (connection.connectionType === 'SQLSERVER') {
      throw new ValidationError('Sampling preview is currently supported for PostgreSQL and MySQL connections');
    }

    if (connection.connectionType === 'POSTGRESQL') {
      return this.samplePostgresTable(connection, password, {
        ...input,
        limit: safeLimit,
      });
    }

    if (connection.connectionType === 'MYSQL') {
      return this.sampleMySqlTable(connection, password, {
        ...input,
        limit: safeLimit,
      });
    }

    throw new ValidationError(`Unsupported connection type: ${connection.connectionType}`);
  }

  /**
   * Record schema exploration for audit trail
   */
  private async recordSchemaExploration(connectionId: string, schema: SourceSchema): Promise<void> {
    try {
      let totalTables = 0;
      let totalColumns = 0;

      for (const db of schema.databases) {
        totalTables += db.tables.length;
        for (const table of db.tables) {
          totalColumns += table.columns?.length || 0;
        }
      }

      await prisma.schemaExploration.create({
        data: {
          connectionId,
          databaseCount: schema.databases.length,
          tableCount: totalTables,
          columnCount: totalColumns,
          schemaData: schema as any,
          exploredAt: new Date(),
        },
      });

      logger.info({ connectionId, databases: schema.databases.length, tables: totalTables }, 'Schema exploration recorded');
    } catch (error) {
      logger.warn({ connectionId, error }, 'Failed to record schema exploration');
      // Don't throw - this shouldn't fail the entire operation
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

    const password = connection.encryptedPassword
      ? this.decryptPassword(connection.encryptedPassword)
      : undefined;

    const schema = await this.exploreSource(connectionId);
    let assetsCreated = 0;
    let assetsUpdated = 0;
    const syncedAssetByPath = new Map<string, string>();

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

          // Refresh schema for existing asset
          await catalogService.registerSchema(
            existingAsset.assetId,
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

          // Update sync timestamp link
          await prisma.connectionAsset.update({
            where: { id: existingAsset.id },
            data: { lastSyncedAt: new Date() },
          });

          syncedAssetByPath.set(fullName, existingAsset.assetId);

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

          syncedAssetByPath.set(fullName, asset.id);

          assetsCreated++;
        }
      }
    }

    if (connection.connectionType === 'SQLSERVER') {
      await this.createSqlServerForeignKeyLineage(connection, password, syncedAssetByPath);
    }

    logger.info({ connectionId, assetsCreated, assetsUpdated }, 'Metadata extracted');

    // Record sync history
    await this.recordSyncHistory(connectionId, assetsCreated, assetsUpdated, incremental);

    return { assetsCreated, assetsUpdated };
  }

  private async createSqlServerForeignKeyLineage(
    connection: {
      id: string;
      host: string;
      port: number;
      database: string | null;
      username: string | null;
    },
    password: string | undefined,
    syncedAssetByPath: Map<string, string>
  ): Promise<void> {
    const fkRows = await this.executeSqlServerQuery(
      connection,
      password,
      `
      SELECT
        DB_NAME() AS database_name,
        parent_schema.name AS parent_schema,
        parent_table.name AS parent_table,
        child_schema.name AS child_schema,
        child_table.name AS child_table,
        fk.name AS constraint_name
      FROM sys.foreign_keys fk
      INNER JOIN sys.tables child_table
        ON fk.parent_object_id = child_table.object_id
      INNER JOIN sys.schemas child_schema
        ON child_table.schema_id = child_schema.schema_id
      INNER JOIN sys.tables parent_table
        ON fk.referenced_object_id = parent_table.object_id
      INNER JOIN sys.schemas parent_schema
        ON parent_table.schema_id = parent_schema.schema_id
      ORDER BY parent_schema.name, parent_table.name, child_schema.name, child_table.name
      `
    );

    for (const row of fkRows) {
      const dbName = String(row['database_name'] ?? connection.database ?? 'master');
      const parentPath = `${dbName}.${String(row['parent_schema'])}.${String(row['parent_table'])}`;
      const childPath = `${dbName}.${String(row['child_schema'])}.${String(row['child_table'])}`;

      const sourceAssetId = syncedAssetByPath.get(parentPath);
      const targetAssetId = syncedAssetByPath.get(childPath);

      if (!sourceAssetId || !targetAssetId || sourceAssetId === targetAssetId) {
        continue;
      }

      await prisma.lineageEdge.upsert({
        where: {
          sourceAssetId_targetAssetId: {
            sourceAssetId,
            targetAssetId,
          },
        },
        update: {
          transformationType: 'FOREIGN_KEY',
          transformationLogic: `Foreign key dependency: ${String(row['constraint_name'] ?? 'unknown_constraint')}`,
          metadata: {
            source: 'SQLSERVER_METADATA_SYNC',
            relationship: 'FOREIGN_KEY',
            constraintName: String(row['constraint_name'] ?? ''),
            parentPath,
            childPath,
          },
        },
        create: {
          sourceAssetId,
          targetAssetId,
          transformationType: 'FOREIGN_KEY',
          transformationLogic: `Foreign key dependency: ${String(row['constraint_name'] ?? 'unknown_constraint')}`,
          metadata: {
            source: 'SQLSERVER_METADATA_SYNC',
            relationship: 'FOREIGN_KEY',
            constraintName: String(row['constraint_name'] ?? ''),
            parentPath,
            childPath,
          },
        },
      });
    }
  }

  /**
   * Record metadata sync for audit trail
   */
  private async recordSyncHistory(
    connectionId: string,
    assetsCreated: number,
    assetsUpdated: number,
    incremental: boolean
  ): Promise<void> {
    try {
      await prisma.syncHistory.create({
        data: {
          connectionId,
          assetsCreatedCount: assetsCreated,
          assetsUpdatedCount: assetsUpdated,
          syncType: incremental ? 'INCREMENTAL' : 'FULL',
          status: 'SUCCESS',
          syncedAt: new Date(),
        },
      });

      logger.info({ connectionId, assetsCreated, assetsUpdated }, 'Sync history recorded');
    } catch (error) {
      logger.warn({ connectionId, error }, 'Failed to record sync history');
      // Don't throw - this shouldn't fail the entire operation
    }
  }

  /**
   * Get schema exploration history for a connection
   */
  async getSchemaExplorationHistory(connectionId: string, limit: number = 20): Promise<any[]> {
    return await prisma.schemaExploration.findMany({
      where: { connectionId },
      orderBy: { exploredAt: 'desc' },
      take: limit,
      select: {
        id: true,
        databaseCount: true,
        tableCount: true,
        columnCount: true,
        exploredAt: true,
      },
    });
  }

  /**
   * Get sync history for a connection
   */
  async getSyncHistory(connectionId: string, limit: number = 20): Promise<any[]> {
    return await prisma.syncHistory.findMany({
      where: { connectionId },
      orderBy: { syncedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        assetsCreatedCount: true,
        assetsUpdatedCount: true,
        assetFailedCount: true,
        syncType: true,
        status: true,
        errorMessage: true,
        syncedAt: true,
      },
    });
  }

  /**
   * Get latest sync information for a connection
   */
  async getLatestSyncInfo(connectionId: string): Promise<any> {
    const latestSync = await prisma.syncHistory.findFirst({
      where: { connectionId },
      orderBy: { syncedAt: 'desc' },
      select: {
        assetsCreatedCount: true,
        assetsUpdatedCount: true,
        syncType: true,
        status: true,
        syncedAt: true,
      },
    });

    const latestExplore = await prisma.schemaExploration.findFirst({
      where: { connectionId },
      orderBy: { exploredAt: 'desc' },
      select: {
        databaseCount: true,
        tableCount: true,
        columnCount: true,
        exploredAt: true,
      },
    });

    return {
      lastSync: latestSync,
      lastExploration: latestExplore,
    };
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
    const pool = await createMySqlPool(
      this.buildMySqlPoolConfig(connection, password, connection.database ?? undefined, {
        connectionLimit: 1,
        connectTimeout: 5000,
      })
    );

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
    const pool = await createMySqlPool(
      this.buildMySqlPoolConfig(connection, password, connection.database ?? undefined)
    );

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
    const rows = await this.executeSqlServerQuery(
      connection,
      password,
      `
      SELECT
        c.TABLE_CATALOG AS database_name,
        c.TABLE_SCHEMA AS schema_name,
        c.TABLE_NAME AS table_name,
        c.COLUMN_NAME AS column_name,
        c.DATA_TYPE AS data_type,
        c.IS_NULLABLE AS is_nullable,
        c.COLUMN_DEFAULT AS column_default,
        CASE WHEN tc.CONSTRAINT_TYPE = 'PRIMARY KEY' THEN 1 ELSE 0 END AS is_primary_key
      FROM INFORMATION_SCHEMA.COLUMNS c
      INNER JOIN INFORMATION_SCHEMA.TABLES t
        ON t.TABLE_CATALOG = c.TABLE_CATALOG
        AND t.TABLE_SCHEMA = c.TABLE_SCHEMA
        AND t.TABLE_NAME = c.TABLE_NAME
      LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
        ON kcu.TABLE_CATALOG = c.TABLE_CATALOG
        AND kcu.TABLE_SCHEMA = c.TABLE_SCHEMA
        AND kcu.TABLE_NAME = c.TABLE_NAME
        AND kcu.COLUMN_NAME = c.COLUMN_NAME
      LEFT JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        ON tc.CONSTRAINT_CATALOG = kcu.CONSTRAINT_CATALOG
        AND tc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
        AND tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
        AND tc.TABLE_CATALOG = kcu.TABLE_CATALOG
        AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
        AND tc.TABLE_NAME = kcu.TABLE_NAME
      WHERE c.TABLE_SCHEMA NOT IN ('INFORMATION_SCHEMA', 'sys')
        AND t.TABLE_TYPE = 'BASE TABLE'
      ORDER BY c.TABLE_CATALOG, c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION
      `
    );

    const databaseMap = new Map<string, DatabaseSchema>();
    const tableMap = new Map<string, TableSchema>();

    for (const row of rows) {
      const databaseName = String(row['database_name'] ?? connection.database ?? 'master');
      const schemaName = String(row['schema_name'] ?? 'dbo');
      const tableName = String(row['table_name'] ?? '');

      if (!tableName) {
        continue;
      }

      if (!databaseMap.has(databaseName)) {
        databaseMap.set(databaseName, {
          name: databaseName,
          tables: [],
        });
      }

      const tableKey = `${databaseName}.${schemaName}.${tableName}`;

      if (!tableMap.has(tableKey)) {
        const table: TableSchema = {
          name: tableName,
          schema: schemaName,
          columns: [],
        };

        tableMap.set(tableKey, table);
        databaseMap.get(databaseName)!.tables.push(table);
      }

      const columnDefault = row['column_default'];

      tableMap.get(tableKey)!.columns.push({
        name: String(row['column_name'] ?? ''),
        dataType: String(row['data_type'] ?? 'nvarchar'),
        nullable: String(row['is_nullable'] ?? 'YES').toUpperCase() === 'YES',
        primaryKey: Number(row['is_primary_key'] ?? 0) === 1,
        ...(columnDefault !== null && columnDefault !== undefined
          ? { defaultValue: String(columnDefault) }
          : {}),
      });
    }

    return { databases: Array.from(databaseMap.values()) };
  }

  private async executeSqlServerQuery(
    connection: { host: string; port: number; database: string | null; username: string | null },
    password: string | undefined,
    sql: string
  ): Promise<Array<Record<string, unknown>>> {
    return new Promise((resolve, reject) => {
      const rows: Array<Record<string, unknown>> = [];
      let settled = false;

      const finishWithError = (error: Error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      const finishSuccess = () => {
        if (settled) return;
        settled = true;
        resolve(rows);
      };

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
          finishWithError(err);
          return;
        }

        const request = new Request(sql, requestError => {
          tediousConnection.close();

          if (requestError) {
            finishWithError(requestError);
            return;
          }

          finishSuccess();
        });

        request.on('row', columns => {
          const row: Record<string, unknown> = {};
          for (const column of columns) {
            row[column.metadata.colName] = column.value;
          }
          rows.push(row);
        });

        tediousConnection.execSql(request);
      });

      tediousConnection.on('error', err => {
        finishWithError(err as Error);
      });

      tediousConnection.connect();
    });
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

  private async samplePostgresTable(
    connection: { host: string; port: number; database: string | null; username: string | null },
    password: string | undefined,
    input: TableSampleInput
  ): Promise<TableSampleResult> {
    const pool = new PgPool({
      host: connection.host,
      port: connection.port,
      database: connection.database ?? 'postgres',
      user: connection.username ?? undefined,
      password,
    });

    const schemaName = input.schema ?? 'public';
    const tableRef = `${this.quotePostgresIdentifier(schemaName)}.${this.quotePostgresIdentifier(input.table)}`;
    const orderClause = input.sampleMode === 'RANDOM_N' ? 'ORDER BY RANDOM()' : '';
    const sql = `SELECT * FROM ${tableRef} ${orderClause} LIMIT $1`;

    try {
      const result = await pool.query(sql, [input.limit]);
      const firstRow = result.rows[0] as Record<string, unknown> | undefined;
      const columns = firstRow ? Object.keys(firstRow) : [];

      return {
        database: input.database,
        schema: schemaName,
        table: input.table,
        dialect: 'POSTGRESQL',
        sqlPreview: sql.replace('$1', String(input.limit)),
        sampleMode: input.sampleMode,
        limit: input.limit,
        returnedRows: result.rows.length,
        columns,
        rows: result.rows as Array<Record<string, unknown>>,
      };
    } finally {
      await pool.end();
    }
  }

  private async sampleMySqlTable(
    connection: { host: string; port: number; database: string | null; username: string | null },
    password: string | undefined,
    input: TableSampleInput
  ): Promise<TableSampleResult> {
    const pool = await createMySqlPool(
      this.buildMySqlPoolConfig(connection, password, connection.database ?? input.database, {
        connectionLimit: 1,
      })
    );

    const tableRef = `${this.quoteMySqlIdentifier(input.database)}.${this.quoteMySqlIdentifier(input.table)}`;
    const orderClause = input.sampleMode === 'RANDOM_N' ? 'ORDER BY RAND()' : '';
    const sql = `SELECT * FROM ${tableRef} ${orderClause} LIMIT ?`;

    try {
      const [rows] = await pool.query(sql, [input.limit]);
      const castRows = rows as Array<Record<string, unknown>>;
      const firstRow = castRows[0];
      const columns = firstRow ? Object.keys(firstRow) : [];

      return {
        database: input.database,
        ...(input.schema ? { schema: input.schema } : {}),
        table: input.table,
        dialect: 'MYSQL',
        sqlPreview: sql.replace('?', String(input.limit)),
        sampleMode: input.sampleMode,
        limit: input.limit,
        returnedRows: castRows.length,
        columns,
        rows: castRows,
      };
    } finally {
      await pool.end();
    }
  }

  private buildMySqlPoolConfig(
    connection: { host: string; port: number; database: string | null; username: string | null },
    password?: string,
    database?: string,
    extra: Record<string, number> = {}
  ): Record<string, unknown> {
    return {
      host: connection.host,
      port: connection.port,
      ...(database ? { database } : {}),
      ...(connection.username ? { user: connection.username } : {}),
      ...(password ? { password } : {}),
      ...extra,
    };
  }

  private quotePostgresIdentifier(value: string): string {
    return `"${value.replace(/"/g, '""')}"`;
  }

  private quoteMySqlIdentifier(value: string): string {
    return `\`${value.replace(/`/g, '``')}\``;
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
