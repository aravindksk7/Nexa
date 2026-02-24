import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type RelationshipType = 'DERIVED_FROM' | 'RELATED_TO' | 'REPLACES' | 'CONTAINS' | 'DEPENDS_ON';

interface AssetRelationship {
  id: string;
  sourceAssetId: string;
  targetAssetId: string;
  relationshipType: RelationshipType;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

interface AssetRelationshipWithAssets extends AssetRelationship {
  sourceAsset?: {
    id: string;
    name: string;
    type: string;
  };
  targetAsset?: {
    id: string;
    name: string;
    type: string;
  };
}

interface CreateRelationshipInput {
  sourceAssetId: string;
  targetAssetId: string;
  relationshipType: RelationshipType;
  metadata?: Record<string, unknown>;
}

export class RelationshipService {
  /**
   * Create a new asset relationship
   */
  async createRelationship(input: CreateRelationshipInput): Promise<AssetRelationship> {
    // Validate source asset exists
    const sourceAsset = await prisma.asset.findUnique({
      where: { id: input.sourceAssetId },
    });

    if (!sourceAsset) {
      throw new Error(`Source asset ${input.sourceAssetId} not found`);
    }

    // Validate target asset exists
    const targetAsset = await prisma.asset.findUnique({
      where: { id: input.targetAssetId },
    });

    if (!targetAsset) {
      throw new Error(`Target asset ${input.targetAssetId} not found`);
    }

    // Prevent self-relationships
    if (input.sourceAssetId === input.targetAssetId) {
      throw new Error('Cannot create relationship between an asset and itself');
    }

    // Check for circular relationships for certain types
    if (['DERIVED_FROM', 'DEPENDS_ON', 'CONTAINS'].includes(input.relationshipType)) {
      const wouldCreateCycle = await this.checkForCycle(
        input.sourceAssetId,
        input.targetAssetId,
        input.relationshipType
      );

      if (wouldCreateCycle) {
        throw new Error('Creating this relationship would create a circular dependency');
      }
    }

    // Check if relationship already exists
    const existing = await prisma.assetRelationship.findUnique({
      where: {
        sourceAssetId_targetAssetId_relationshipType: {
          sourceAssetId: input.sourceAssetId,
          targetAssetId: input.targetAssetId,
          relationshipType: input.relationshipType,
        },
      },
    });

    if (existing) {
      throw new Error('Relationship already exists');
    }

    const relationship = await prisma.assetRelationship.create({
      data: {
        sourceAssetId: input.sourceAssetId,
        targetAssetId: input.targetAssetId,
        relationshipType: input.relationshipType,
        // @ts-ignore - Prisma JSON type accepts objects
        metadata: input.metadata || null,
      },
    });

    return relationship as AssetRelationship;
  }

  /**
   * Get a relationship by ID
   */
  async getRelationship(relationshipId: string): Promise<AssetRelationshipWithAssets | null> {
    const relationship = await prisma.assetRelationship.findUnique({
      where: { id: relationshipId },
      include: {
        sourceAsset: {
          select: { id: true, name: true, assetType: true },
        },
        targetAsset: {
          select: { id: true, name: true, assetType: true },
        },
      },
    });

    // @ts-ignore - Type mismatch with Prisma selected fields vs interface
    return relationship as AssetRelationshipWithAssets | null;
  }

  /**
   * Get all relationships for an asset
   */
  async getRelationshipsForAsset(
    assetId: string,
    direction: 'source' | 'target' | 'both' = 'both'
  ): Promise<AssetRelationshipWithAssets[]> {
    const whereClause =
      direction === 'source'
        ? { sourceAssetId: assetId }
        : direction === 'target'
        ? { targetAssetId: assetId }
        : { OR: [{ sourceAssetId: assetId }, { targetAssetId: assetId }] };

    const relationships = await prisma.assetRelationship.findMany({
      where: whereClause,
      include: {
        sourceAsset: {
          select: { id: true, name: true, assetType: true },
        },
        targetAsset: {
          select: { id: true, name: true, assetType: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // @ts-ignore - Type mismatch with Prisma selected fields vs interface
    return relationships as AssetRelationshipWithAssets[];
  }

  /**
   * Get relationships by type
   */
  async getRelationshipsByType(
    assetId: string,
    relationshipType: RelationshipType
  ): Promise<AssetRelationshipWithAssets[]> {
    const relationships = await prisma.assetRelationship.findMany({
      where: {
        OR: [
          { sourceAssetId: assetId, relationshipType },
          { targetAssetId: assetId, relationshipType },
        ],
      },
      include: {
        sourceAsset: {
          select: { id: true, name: true, assetType: true },
        },
        targetAsset: {
          select: { id: true, name: true, assetType: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // @ts-ignore - Type mismatch with Prisma selected fields vs interface
    return relationships as AssetRelationshipWithAssets[];
  }

  /**
   * Delete a relationship
   */
  async deleteRelationship(relationshipId: string): Promise<void> {
    await prisma.assetRelationship.delete({
      where: { id: relationshipId },
    });
  }

  /**
   * Delete all relationships for an asset (used during cascading updates)
   */
  async deleteRelationshipsForAsset(assetId: string): Promise<number> {
    const result = await prisma.assetRelationship.deleteMany({
      where: {
        OR: [{ sourceAssetId: assetId }, { targetAssetId: assetId }],
      },
    });

    return result.count;
  }

  /**
   * Get derived assets (assets derived from source)
   */
  async getDerivedAssets(assetId: string): Promise<AssetRelationshipWithAssets[]> {
    const relationships = await prisma.assetRelationship.findMany({
      where: {
        sourceAssetId: assetId,
        relationshipType: 'DERIVED_FROM',
      },
      include: {
        targetAsset: {
          select: { id: true, name: true, assetType: true },
        },
        sourceAsset: {
          select: { id: true, name: true, assetType: true },
        },
      },
    });

    // @ts-ignore - Type mismatch with Prisma selected fields vs interface
    return relationships as AssetRelationshipWithAssets[];
  }

  /**
   * Get source assets (assets this one is derived from)
   */
  async getSourceAssets(assetId: string): Promise<AssetRelationshipWithAssets[]> {
    const relationships = await prisma.assetRelationship.findMany({
      where: {
        targetAssetId: assetId,
        relationshipType: 'DERIVED_FROM',
      },
      include: {
        sourceAsset: {
          select: { id: true, name: true, assetType: true },
        },
        targetAsset: {
          select: { id: true, name: true, assetType: true },
        },
      },
    });

    // @ts-ignore - Type mismatch with Prisma selected fields vs interface
    return relationships as AssetRelationshipWithAssets[];
  }

  /**
   * Check if creating a relationship would create a cycle
   */
  private async checkForCycle(
    sourceAssetId: string,
    targetAssetId: string,
    relationshipType: RelationshipType
  ): Promise<boolean> {
    // Get all existing relationships of this type
    // and check if adding source->target would create a cycle

    const visited = new Set<string>();
    const queue = [targetAssetId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;

      if (currentId === sourceAssetId) {
        return true; // Cycle detected
      }

      if (visited.has(currentId)) {
        continue;
      }

      visited.add(currentId);

      // Get outgoing relationships from current node
      const relationships = await prisma.assetRelationship.findMany({
        where: {
          sourceAssetId: currentId,
          relationshipType,
        },
        select: { targetAssetId: true },
      });

      for (const rel of relationships) {
        if (!visited.has(rel.targetAssetId)) {
          queue.push(rel.targetAssetId);
        }
      }
    }

    return false;
  }

  /**
   * Get relationship types summary for an asset
   */
  async getRelationshipSummary(
    assetId: string
  ): Promise<{ type: RelationshipType; count: number; direction: 'source' | 'target' }[]> {
    const sourceRels = await prisma.assetRelationship.groupBy({
      by: ['relationshipType'],
      where: { sourceAssetId: assetId },
      _count: { id: true },
    });

    const targetRels = await prisma.assetRelationship.groupBy({
      by: ['relationshipType'],
      where: { targetAssetId: assetId },
      _count: { id: true },
    });

    const summary: { type: RelationshipType; count: number; direction: 'source' | 'target' }[] = [];

    for (const rel of sourceRels) {
      summary.push({
        type: rel.relationshipType as RelationshipType,
        count: rel._count.id,
        direction: 'source',
      });
    }

    for (const rel of targetRels) {
      summary.push({
        type: rel.relationshipType as RelationshipType,
        count: rel._count.id,
        direction: 'target',
      });
    }

    return summary;
  }
}

export const relationshipService = new RelationshipService();
