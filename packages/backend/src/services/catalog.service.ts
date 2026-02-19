import { prisma } from '../lib/prisma.js';
import { createChildLogger } from '../utils/logger.js';
import { NotFoundError, ConflictError, ValidationError } from '../middleware/errorHandler.js';
import type {
  Asset,
  CreateAsset,
  UpdateAsset,
  AssetFilters,
  Pagination,
  PaginatedResult,
  CreateSchema,
  Schema,
} from '../models/index.js';

const logger = createChildLogger('CatalogService');

export class CatalogService {
  /**
   * Create a new data asset
   */
  async createAsset(data: CreateAsset, userId: string): Promise<Asset> {
    logger.debug({ name: data.name, assetType: data.assetType }, 'Creating new asset');

    const asset = await prisma.asset.create({
      data: {
        name: data.name,
        description: data.description,
        assetType: data.assetType,
        ownerId: data.ownerId ?? userId,
        domain: data.domain,
        tags: data.tags ?? [],
        customProperties: data.customProperties ?? {},
        createdById: userId,
        updatedById: userId,
      },
    });

    // Create initial version
    await prisma.assetVersion.create({
      data: {
        assetId: asset.id,
        version: 1,
        name: asset.name,
        description: asset.description,
        assetType: asset.assetType,
        domain: asset.domain,
        tags: asset.tags,
        customProperties: asset.customProperties ?? {},
        changedById: userId,
        changeType: 'CREATED',
      },
    });

    logger.info({ assetId: asset.id }, 'Asset created successfully');

    return this.mapAsset(asset);
  }

  /**
   * Get asset by ID
   */
  async getAsset(assetId: string): Promise<Asset> {
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: {
        owner: { select: { id: true, username: true, email: true } },
      },
    });

    if (!asset) {
      throw new NotFoundError('Asset', assetId);
    }

    return this.mapAsset(asset);
  }

  /**
   * Update an existing asset
   */
  async updateAsset(assetId: string, data: UpdateAsset, userId: string): Promise<Asset> {
    const existingAsset = await prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!existingAsset) {
      throw new NotFoundError('Asset', assetId);
    }

    const newVersion = existingAsset.version + 1;

    const asset = await prisma.asset.update({
      where: { id: assetId },
      data: {
        ...data,
        version: newVersion,
        updatedById: userId,
      },
    });

    // Create version entry
    await prisma.assetVersion.create({
      data: {
        assetId: asset.id,
        version: newVersion,
        name: asset.name,
        description: asset.description,
        assetType: asset.assetType,
        domain: asset.domain,
        tags: asset.tags,
        customProperties: asset.customProperties ?? {},
        changedById: userId,
        changeType: 'UPDATED',
      },
    });

    logger.info({ assetId, version: newVersion }, 'Asset updated');

    return this.mapAsset(asset);
  }

  /**
   * Delete an asset
   */
  async deleteAsset(assetId: string, userId: string): Promise<boolean> {
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new NotFoundError('Asset', assetId);
    }

    // Create deletion version entry
    await prisma.assetVersion.create({
      data: {
        assetId: asset.id,
        version: asset.version + 1,
        name: asset.name,
        description: asset.description,
        assetType: asset.assetType,
        domain: asset.domain,
        tags: asset.tags,
        customProperties: asset.customProperties ?? {},
        changedById: userId,
        changeType: 'DELETED',
      },
    });

    await prisma.asset.delete({
      where: { id: assetId },
    });

    logger.info({ assetId }, 'Asset deleted');

    return true;
  }

  /**
   * List assets with filtering and pagination
   */
  async listAssets(
    filters: AssetFilters,
    pagination: Pagination
  ): Promise<PaginatedResult<Asset>> {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (filters.assetType) {
      where['assetType'] = filters.assetType;
    }
    if (filters.ownerId) {
      where['ownerId'] = filters.ownerId;
    }
    if (filters.domain) {
      where['domain'] = filters.domain;
    }
    if (filters.qualityStatus) {
      where['qualityStatus'] = filters.qualityStatus;
    }
    if (filters.tags && filters.tags.length > 0) {
      where['tags'] = { hasSome: filters.tags };
    }
    if (filters.search) {
      where['OR'] = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          owner: { select: { id: true, username: true } },
        },
      }),
      prisma.asset.count({ where }),
    ]);

    return {
      data: assets.map(a => this.mapAsset(a)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get asset version history
   */
  async getAssetHistory(assetId: string): Promise<unknown[]> {
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new NotFoundError('Asset', assetId);
    }

    const versions = await prisma.assetVersion.findMany({
      where: { assetId },
      orderBy: { version: 'desc' },
    });

    return versions;
  }

  /**
   * Compare two versions of an asset
   */
  async compareVersions(
    assetId: string,
    version1: number,
    version2: number
  ): Promise<{
    version1: unknown;
    version2: unknown;
    changes: { field: string; oldValue: unknown; newValue: unknown }[];
  }> {
    const v1 = await prisma.assetVersion.findFirst({
      where: { assetId, version: version1 },
    });

    const v2 = await prisma.assetVersion.findFirst({
      where: { assetId, version: version2 },
    });

    if (!v1 || !v2) {
      throw new NotFoundError('Asset version', `${version1} or ${version2}`);
    }

    const changes: { field: string; oldValue: unknown; newValue: unknown }[] = [];

    // Compare direct fields from AssetVersion
    const fieldsToCompare = ['name', 'description', 'domain', 'tags', 'customProperties'] as const;

    for (const field of fieldsToCompare) {
      const val1 = v1[field as keyof typeof v1];
      const val2 = v2[field as keyof typeof v2];

      if (JSON.stringify(val1) !== JSON.stringify(val2)) {
        changes.push({
          field,
          oldValue: val1,
          newValue: val2,
        });
      }
    }

    return {
      version1: v1,
      version2: v2,
      changes,
    };
  }

  /**
   * Restore an asset to a specific version (creates a new version)
   */
  async restoreVersion(
    assetId: string,
    version: number,
    userId: string
  ): Promise<Asset> {
    const versionToRestore = await prisma.assetVersion.findFirst({
      where: { assetId, version },
    });

    if (!versionToRestore) {
      throw new NotFoundError('Asset version', String(version));
    }

    const currentAsset = await prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!currentAsset) {
      throw new NotFoundError('Asset', assetId);
    }

    // Update the asset with the restored version data
    const newVersion = currentAsset.version + 1;

    const restoredAsset = await prisma.asset.update({
      where: { id: assetId },
      data: {
        name: versionToRestore.name,
        description: versionToRestore.description,
        domain: versionToRestore.domain,
        tags: versionToRestore.tags,
        customProperties: versionToRestore.customProperties ?? {},
        version: newVersion,
        updatedAt: new Date(),
        updatedById: userId,
      },
    });

    // Create a new version entry marking this as a restore
    await prisma.assetVersion.create({
      data: {
        assetId,
        version: newVersion,
        name: restoredAsset.name,
        description: restoredAsset.description,
        assetType: restoredAsset.assetType,
        domain: restoredAsset.domain,
        tags: restoredAsset.tags,
        customProperties: restoredAsset.customProperties ?? {},
        changeType: 'RESTORED',
        changedById: userId,
      },
    });

    logger.info({ assetId, restoredFromVersion: version, newVersion }, 'Asset restored');

    return restoredAsset as Asset;
  }

  /**
   * Register a schema for an asset
   */
  async registerSchema(
    assetId: string,
    data: CreateSchema,
    userId: string
  ): Promise<Schema> {
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new NotFoundError('Asset', assetId);
    }

    // Get latest schema version
    const latestSchema = await prisma.schema.findFirst({
      where: { assetId },
      orderBy: { version: 'desc' },
    });

    const newVersion = (latestSchema?.version ?? 0) + 1;

    // Detect breaking changes if previous version exists
    let isBreakingChange = false;
    let breakingDetails = null;

    if (latestSchema) {
      const detection = this.detectBreakingChanges(
        latestSchema.schemaDefinition as Record<string, unknown>,
        data.schemaDefinition
      );
      isBreakingChange = detection.isBreaking;
      breakingDetails = detection.details;
    }

    const schema = await prisma.schema.create({
      data: {
        assetId,
        version: newVersion,
        schemaFormat: data.schemaFormat,
        schemaDefinition: data.schemaDefinition,
        isBreakingChange,
        breakingDetails,
        createdById: userId,
      },
    });

    logger.info({ assetId, schemaVersion: newVersion, isBreakingChange }, 'Schema registered');

    return this.mapSchema(schema);
  }

  /**
   * Get schemas for an asset
   */
  async getSchemas(assetId: string): Promise<Schema[]> {
    const schemas = await prisma.schema.findMany({
      where: { assetId },
      orderBy: { version: 'desc' },
    });

    return schemas.map(s => this.mapSchema(s));
  }

  /**
   * Get specific schema version
   */
  async getSchemaVersion(assetId: string, version: number): Promise<Schema> {
    const schema = await prisma.schema.findUnique({
      where: {
        assetId_version: { assetId, version },
      },
    });

    if (!schema) {
      throw new NotFoundError('Schema', `${assetId}:v${version}`);
    }

    return this.mapSchema(schema);
  }

  /**
   * Detect breaking changes between schema versions
   */
  private detectBreakingChanges(
    oldSchema: Record<string, unknown>,
    newSchema: Record<string, unknown>
  ): { isBreaking: boolean; details: unknown } {
    const breaking: string[] = [];

    // Simple field-level comparison for JSON Schema
    const oldFields = this.extractFields(oldSchema);
    const newFields = this.extractFields(newSchema);

    // Check for removed fields
    for (const field of oldFields) {
      if (!newFields.includes(field)) {
        breaking.push(`Removed field: ${field}`);
      }
    }

    // Check for required fields that were added
    const oldRequired = (oldSchema['required'] as string[]) ?? [];
    const newRequired = (newSchema['required'] as string[]) ?? [];

    for (const field of newRequired) {
      if (!oldRequired.includes(field) && !oldFields.includes(field)) {
        breaking.push(`Added required field: ${field}`);
      }
    }

    return {
      isBreaking: breaking.length > 0,
      details: breaking.length > 0 ? { changes: breaking } : null,
    };
  }

  /**
   * Extract field names from schema
   */
  private extractFields(schema: Record<string, unknown>): string[] {
    const properties = schema['properties'] as Record<string, unknown> | undefined;
    return properties ? Object.keys(properties) : [];
  }

  /**
   * Map Prisma asset to domain model
   */
  private mapAsset(asset: {
    id: string;
    name: string;
    description: string | null;
    assetType: string;
    ownerId: string;
    domain: string | null;
    tags: string[];
    customProperties: unknown;
    qualityStatus: string;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    createdById: string;
    updatedById: string;
  }): Asset {
    return {
      id: asset.id,
      name: asset.name,
      description: asset.description ?? undefined,
      assetType: asset.assetType as Asset['assetType'],
      ownerId: asset.ownerId,
      domain: asset.domain ?? undefined,
      tags: asset.tags,
      customProperties: asset.customProperties as Record<string, unknown> | undefined,
      qualityStatus: asset.qualityStatus as Asset['qualityStatus'],
      version: asset.version,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
      createdById: asset.createdById,
      updatedById: asset.updatedById,
    };
  }

  /**
   * Map Prisma schema to domain model
   */
  private mapSchema(schema: {
    id: string;
    assetId: string;
    version: number;
    schemaFormat: string;
    schemaDefinition: unknown;
    isBreakingChange: boolean;
    breakingDetails: unknown;
    createdAt: Date;
    createdById: string;
  }): Schema {
    return {
      id: schema.id,
      assetId: schema.assetId,
      version: schema.version,
      schemaFormat: schema.schemaFormat as Schema['schemaFormat'],
      schemaDefinition: schema.schemaDefinition as Record<string, unknown>,
      isBreakingChange: schema.isBreakingChange,
      breakingDetails: schema.breakingDetails as Record<string, unknown> | undefined,
      createdAt: schema.createdAt,
      createdById: schema.createdById,
    };
  }

  /**
   * Get data preview for an asset
   * Returns sample rows from the data source
   */
  async getDataPreview(assetId: string, limit: number = 100): Promise<{
    columns: string[];
    rows: Record<string, unknown>[];
    totalRows: number;
  }> {
    const asset = await this.getAsset(assetId);
    logger.debug({ assetId, limit }, 'Getting data preview');

    // Get the latest schema to determine columns
    const schemas = await this.getSchemas(assetId);
    const latestSchema = schemas[0];

    // Generate sample preview data based on schema or asset type
    const columns = latestSchema
      ? this.extractFieldsFromSchema(latestSchema.schemaDefinition)
      : this.getDefaultColumnsForType(asset.assetType);

    // In production, this would query the actual data source
    // For now, generate sample data based on the schema
    const rows = this.generateSampleRows(columns, Math.min(limit, 100));

    return {
      columns,
      rows,
      totalRows: rows.length,
    };
  }

  /**
   * Get data profiling statistics for an asset
   */
  async getDataProfile(assetId: string): Promise<{
    assetId: string;
    rowCount: number;
    columnCount: number;
    columns: {
      name: string;
      dataType: string;
      nullCount: number;
      nullPercentage: number;
      distinctCount: number;
      min?: string | number;
      max?: string | number;
      mean?: number;
      stdDev?: number;
      topValues?: { value: string; count: number }[];
    }[];
    lastProfiledAt: Date;
  }> {
    const asset = await this.getAsset(assetId);
    logger.debug({ assetId }, 'Getting data profile');

    // Get the latest schema to determine columns
    const schemas = await this.getSchemas(assetId);
    const latestSchema = schemas[0];

    const columns = latestSchema
      ? this.extractFieldsFromSchema(latestSchema.schemaDefinition)
      : this.getDefaultColumnsForType(asset.assetType);

    // In production, this would run actual profiling queries
    // For now, generate sample profiling stats
    const profiledColumns = columns.map((colName, index) => {
      const isNumeric = ['id', 'amount', 'quantity', 'price', 'count', 'age'].some(
        n => colName.toLowerCase().includes(n)
      );
      const isDate = ['date', 'time', 'created', 'updated'].some(
        n => colName.toLowerCase().includes(n)
      );

      const baseProfile = {
        name: colName,
        dataType: isNumeric ? 'INTEGER' : isDate ? 'TIMESTAMP' : 'VARCHAR',
        nullCount: Math.floor(Math.random() * 50),
        nullPercentage: Math.random() * 5,
        distinctCount: Math.floor(Math.random() * 1000) + 10,
      };

      if (isNumeric) {
        return {
          ...baseProfile,
          min: Math.floor(Math.random() * 10),
          max: Math.floor(Math.random() * 10000) + 100,
          mean: Math.random() * 500 + 50,
          stdDev: Math.random() * 100,
        };
      }

      return {
        ...baseProfile,
        topValues: [
          { value: `value_${index}_1`, count: Math.floor(Math.random() * 100) + 50 },
          { value: `value_${index}_2`, count: Math.floor(Math.random() * 80) + 30 },
          { value: `value_${index}_3`, count: Math.floor(Math.random() * 60) + 20 },
        ],
      };
    });

    return {
      assetId,
      rowCount: Math.floor(Math.random() * 100000) + 1000,
      columnCount: columns.length,
      columns: profiledColumns,
      lastProfiledAt: new Date(),
    };
  }

  /**
   * Extract field names from a JSON Schema
   */
  private extractFieldsFromSchema(schema: Record<string, unknown>): string[] {
    const properties = schema['properties'] as Record<string, unknown> | undefined;
    if (properties) {
      return Object.keys(properties);
    }
    return this.extractFields(schema);
  }

  /**
   * Get default columns based on asset type
   */
  private getDefaultColumnsForType(assetType: string): string[] {
    switch (assetType) {
      case 'TABLE':
      case 'VIEW':
        return ['id', 'name', 'created_at', 'updated_at', 'status'];
      case 'DATASET':
        return ['record_id', 'data', 'timestamp', 'source'];
      case 'TOPIC':
        return ['event_id', 'event_type', 'payload', 'timestamp'];
      default:
        return ['id', 'value', 'metadata'];
    }
  }

  /**
   * Generate sample rows for preview
   */
  private generateSampleRows(columns: string[], count: number): Record<string, unknown>[] {
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < count; i++) {
      const row: Record<string, unknown> = {};
      for (const col of columns) {
        if (col.toLowerCase().includes('id')) {
          row[col] = i + 1;
        } else if (col.toLowerCase().includes('date') || col.toLowerCase().includes('time') || col.toLowerCase().includes('created') || col.toLowerCase().includes('updated')) {
          row[col] = new Date(Date.now() - Math.random() * 86400000 * 365).toISOString();
        } else if (col.toLowerCase().includes('amount') || col.toLowerCase().includes('price') || col.toLowerCase().includes('quantity')) {
          row[col] = parseFloat((Math.random() * 1000).toFixed(2));
        } else if (col.toLowerCase().includes('status')) {
          row[col] = ['ACTIVE', 'INACTIVE', 'PENDING'][Math.floor(Math.random() * 3)];
        } else if (col.toLowerCase().includes('name')) {
          row[col] = `Sample Name ${i + 1}`;
        } else {
          row[col] = `Sample ${col} ${i + 1}`;
        }
      }
      rows.push(row);
    }
    return rows;
  }
}

export const catalogService = new CatalogService();
