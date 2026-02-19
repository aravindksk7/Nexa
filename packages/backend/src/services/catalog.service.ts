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
}

export const catalogService = new CatalogService();
