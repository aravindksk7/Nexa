import { prisma } from '../lib/prisma.js';
import { createChildLogger } from '../utils/logger.js';
import type { Asset, AssetFilters, PaginatedResult, Pagination } from '../models/index.js';

const logger = createChildLogger('SearchService');

export interface SearchResult {
  asset: Asset;
  score: number;
  highlights: { field: string; snippet: string }[];
}

export interface FacetValue {
  value: string;
  count: number;
}

export interface SearchFacets {
  assetTypes: FacetValue[];
  domains: FacetValue[];
  tags: FacetValue[];
  qualityStatuses: FacetValue[];
}

export interface SearchOptions {
  page?: number;
  pageSize?: number;
  assetTypes?: string[];
  owners?: string[];
  tags?: string[];
  domains?: string[];
  sortBy?: string;
  sortOrder?: string;
}

export class SearchService {
  /**
   * Search for assets using full-text search
   */
  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<PaginatedResult<SearchResult>> {
    const page = Number(options.page) || 1;
    const limit = Number(options.pageSize) || 20;
    const skip = (page - 1) * limit;

    // Build search conditions
    const searchConditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    // Full-text search on name and description
    if (query) {
      searchConditions.push(`(
        name ILIKE $${paramIndex} OR
        description ILIKE $${paramIndex} OR
        $${paramIndex + 1} = ANY(tags)
      )`);
      params.push(`%${query}%`, query);
      paramIndex += 2;
    }

    // Apply filters
    if (options.assetTypes && options.assetTypes.length > 0) {
      searchConditions.push(`asset_type = ANY($${paramIndex}::text[])`);
      params.push(options.assetTypes);
      paramIndex++;
    }

    if (options.owners && options.owners.length > 0) {
      searchConditions.push(`owner_id = ANY($${paramIndex}::text[])`);
      params.push(options.owners);
      paramIndex++;
    }

    if (options.domains && options.domains.length > 0) {
      searchConditions.push(`domain = ANY($${paramIndex}::text[])`);
      params.push(options.domains);
      paramIndex++;
    }

    if (options.tags && options.tags.length > 0) {
      searchConditions.push(`tags && $${paramIndex}::text[]`);
      params.push(options.tags);
      paramIndex++;
    }

    const whereClause = searchConditions.length > 0
      ? `WHERE ${searchConditions.join(' AND ')}`
      : '';

    // Execute search query using Prisma raw query
    interface RawAssetRow {
      id: string;
      name: string;
      description: string | null;
      asset_type: string;
      owner_id: string;
      domain: string | null;
      tags: string[];
      custom_properties: unknown;
      quality_status: string;
      version: number;
      created_at: Date;
      updated_at: Date;
      created_by_id: string;
      updated_by_id: string;
      score: number;
    }

    // @ts-ignore - $queryRawUnsafe is untyped in some TypeScript environments
    const assets = await prisma.$queryRawUnsafe(`
      SELECT 
        id, name, description, asset_type, owner_id, domain, tags,
        custom_properties, quality_status, version, created_at, updated_at,
        created_by_id, updated_by_id,
        CASE 
          WHEN name ILIKE $1 THEN 10
          WHEN description ILIKE $1 THEN 5
          ELSE 1
        END as score
      FROM assets
      ${whereClause}
      ORDER BY score DESC, updated_at DESC
      LIMIT $${paramIndex}::integer OFFSET $${paramIndex + 1}::integer
    `, ...params, limit, skip) as RawAssetRow[];

    // Get total count
    // @ts-ignore - $queryRawUnsafe is untyped in some TypeScript environments
    const countResult = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as count FROM assets ${whereClause}
    `, ...params) as { count: bigint }[];

    const total = Number(countResult[0]?.count ?? 0);

    // Map results
    const results: SearchResult[] = assets.map(asset => ({
      asset: this.mapAsset(asset),
      score: asset.score,
      highlights: this.generateHighlights(asset, query),
    }));

    return {
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get search suggestions based on partial query
   */
  async suggest(partialQuery: string): Promise<string[]> {
    if (!partialQuery || partialQuery.length < 2) {
      return [];
    }

    // Search for matching asset names and tags
    const results = await prisma.asset.findMany({
      where: {
        OR: [
          { name: { contains: partialQuery, mode: 'insensitive' } },
          { tags: { hasSome: [partialQuery] } },
        ],
      },
      select: { name: true, tags: true },
      take: 10,
    });

    const suggestions = new Set<string>();

    for (const result of results) {
      // Add matching name parts
      if (result.name.toLowerCase().includes(partialQuery.toLowerCase())) {
        suggestions.add(result.name);
      }

      // Add matching tags
      for (const tag of result.tags) {
        if (tag.toLowerCase().includes(partialQuery.toLowerCase())) {
          suggestions.add(tag);
        }
      }
    }

    return Array.from(suggestions).slice(0, 10);
  }

  /**
   * Get faceted search results
   */
  async getFacets(query?: string): Promise<SearchFacets> {
    const whereClause = query
      ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' as const } },
            { description: { contains: query, mode: 'insensitive' as const } },
          ],
        }
      : {};

    // Get asset type counts
    const assetTypeCounts = await prisma.asset.groupBy({
      by: ['assetType'],
      where: whereClause,
      _count: { _all: true },
    });

    // Get domain counts
    const domainCounts = await prisma.asset.groupBy({
      by: ['domain'],
      where: { ...whereClause, domain: { not: null } },
      _count: { _all: true },
    });

    // Get quality status counts
    const qualityStatusCounts = await prisma.asset.groupBy({
      by: ['qualityStatus'],
      where: whereClause,
      _count: { _all: true },
    });

    // Get tag counts (requires aggregation)
    const allTags = await prisma.asset.findMany({
      where: whereClause,
      select: { tags: true },
    });

    const tagCounts = new Map<string, number>();
    for (const asset of allTags) {
      for (const tag of asset.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }

    return {
      assetTypes: assetTypeCounts.map(r => ({
        value: r.assetType,
        count: r._count._all,
      })),
      domains: domainCounts.map(r => ({
        value: r.domain ?? '',
        count: r._count._all,
      })),
      qualityStatuses: qualityStatusCounts.map(r => ({
        value: r.qualityStatus,
        count: r._count._all,
      })),
      tags: Array.from(tagCounts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),
    };
  }

  /**
   * Generate search highlights
   */
  private generateHighlights(
    asset: { name: string; description: string | null; tags: string[] },
    query: string
  ): { field: string; snippet: string }[] {
    const highlights: { field: string; snippet: string }[] = [];

    if (!query) return highlights;

    const lowerQuery = query.toLowerCase();

    if (asset.name.toLowerCase().includes(lowerQuery)) {
      highlights.push({
        field: 'name',
        snippet: this.highlightText(asset.name, query),
      });
    }

    if (asset.description?.toLowerCase().includes(lowerQuery)) {
      highlights.push({
        field: 'description',
        snippet: this.highlightText(asset.description, query),
      });
    }

    for (const tag of asset.tags) {
      if (tag.toLowerCase().includes(lowerQuery)) {
        highlights.push({
          field: 'tags',
          snippet: this.highlightText(tag, query),
        });
      }
    }

    return highlights;
  }

  /**
   * Highlight matching text
   */
  private highlightText(text: string, query: string): string {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  /**
   * Map raw query result to Asset
   */
  private mapAsset(row: {
    id: string;
    name: string;
    description: string | null;
    asset_type: string;
    owner_id: string;
    domain: string | null;
    tags: string[];
    custom_properties: unknown;
    quality_status: string;
    version: number;
    created_at: Date;
    updated_at: Date;
    created_by_id: string;
    updated_by_id: string;
  }): Asset {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      // @ts-ignore - Raw DB query returns string type, mapping to Asset enum
      assetType: row.asset_type as AssetType,
      ownerId: row.owner_id,
      domain: row.domain ?? undefined,
      tags: row.tags ?? [],
      customProperties: row.custom_properties as Record<string, unknown> | undefined,
      // @ts-ignore - Raw DB query returns string type, mapping to QualityStatus enum
      qualityStatus: row.quality_status as QualityStatus,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdById: row.created_by_id,
      updatedById: row.updated_by_id,
    };
  }
}

export const searchService = new SearchService();
