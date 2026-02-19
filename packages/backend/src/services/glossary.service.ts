import { prisma } from '../lib/prisma.js';
import {
  BusinessDomain,
  BusinessTerm,
  BusinessTermWithMappings,
  CreateBusinessDomain,
  CreateBusinessTerm,
  CreateSemanticMapping,
  SemanticMapping,
  UpdateBusinessTerm,
  AssetWithBusinessTerms,
} from '../models/index.js';

class GlossaryService {
  // =====================
  // Business Domain Operations
  // =====================

  async createDomain(data: CreateBusinessDomain): Promise<BusinessDomain> {
    // Validate parent exists if specified
    if (data.parentId) {
      const parent = await prisma.businessDomain.findUnique({
        where: { id: data.parentId },
      });
      if (!parent) {
        throw new Error('Parent domain not found');
      }
    }

    // Build create data without undefined values
    const createData: Record<string, unknown> = { name: data.name };
    if (data.description !== undefined) createData['description'] = data.description;
    if (data.parentId !== undefined) createData['parentId'] = data.parentId;

    const domain = await prisma.businessDomain.create({
      data: createData as Parameters<typeof prisma.businessDomain.create>[0]['data'],
    });

    return this.mapDomain(domain);
  }

  async getDomain(id: string): Promise<BusinessDomain | null> {
    const domain = await prisma.businessDomain.findUnique({
      where: { id },
    });
    return domain ? this.mapDomain(domain) : null;
  }

  async listDomains(parentId?: string): Promise<BusinessDomain[]> {
    const domains = await prisma.businessDomain.findMany({
      where: parentId !== undefined ? { parentId } : {},
      orderBy: { name: 'asc' },
    });
    return domains.map(this.mapDomain);
  }

  async getDomainHierarchy(): Promise<BusinessDomain[]> {
    // Get all root domains with nested children
    const domains = await prisma.businessDomain.findMany({
      where: { parentId: null },
      include: {
        children: {
          include: {
            children: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    return domains.map(this.mapDomain);
  }

  async updateDomain(id: string, data: Partial<CreateBusinessDomain>): Promise<BusinessDomain> {
    // Prevent circular references
    if (data.parentId === id) {
      throw new Error('A domain cannot be its own parent');
    }

    // Build update data without undefined values
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData['name'] = data.name;
    if (data.description !== undefined) updateData['description'] = data.description;
    if (data.parentId !== undefined) updateData['parentId'] = data.parentId;

    const domain = await prisma.businessDomain.update({
      where: { id },
      data: updateData as Parameters<typeof prisma.businessDomain.update>[0]['data'],
    });

    return this.mapDomain(domain);
  }

  async deleteDomain(id: string): Promise<void> {
    // Check for child domains
    const childCount = await prisma.businessDomain.count({
      where: { parentId: id },
    });
    if (childCount > 0) {
      throw new Error('Cannot delete domain with child domains');
    }

    // Check for terms in this domain
    const termCount = await prisma.businessTerm.count({
      where: { domainId: id },
    });
    if (termCount > 0) {
      throw new Error('Cannot delete domain with existing terms');
    }

    await prisma.businessDomain.delete({
      where: { id },
    });
  }

  // =====================
  // Business Term Operations
  // =====================

  async createTerm(data: CreateBusinessTerm, userId: string): Promise<BusinessTerm> {
    // Validate domain exists
    const domain = await prisma.businessDomain.findUnique({
      where: { id: data.domainId },
    });
    if (!domain) {
      throw new Error('Business domain not found');
    }

    const term = await prisma.businessTerm.create({
      data: {
        name: data.name,
        definition: data.definition,
        domainId: data.domainId,
        ownerId: data.ownerId ?? userId,
        status: data.status ?? 'DRAFT',
        synonyms: data.synonyms ?? [],
        relatedTerms: data.relatedTerms ?? [],
      },
    });

    return this.mapTerm(term);
  }

  async getTerm(id: string): Promise<BusinessTermWithMappings | null> {
    const term = await prisma.businessTerm.findUnique({
      where: { id },
      include: {
        domain: true,
        owner: {
          select: { id: true, username: true, email: true },
        },
        mappings: {
          include: {
            asset: {
              select: { id: true, name: true, assetType: true },
            },
          },
        },
      },
    });

    if (!term) return null;

    return {
      ...this.mapTerm(term),
      domain: this.mapDomain(term.domain),
      owner: term.owner,
      mappings: term.mappings.map(this.mapSemanticMapping),
    };
  }

  async listTerms(options: {
    domainId?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ terms: BusinessTerm[]; total: number }> {
    const where: Record<string, unknown> = {};

    if (options.domainId) {
      where['domainId'] = options.domainId;
    }
    if (options.status) {
      where['status'] = options.status;
    }
    if (options.search) {
      where['OR'] = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { definition: { contains: options.search, mode: 'insensitive' } },
        { synonyms: { has: options.search } },
      ];
    }

    const [terms, total] = await Promise.all([
      prisma.businessTerm.findMany({
        where,
        include: {
          domain: true,
          owner: {
            select: { id: true, username: true, email: true },
          },
        },
        orderBy: { name: 'asc' },
        take: options.limit ?? 50,
        skip: options.offset ?? 0,
      }),
      prisma.businessTerm.count({ where }),
    ]);

    return {
      terms: terms.map(this.mapTerm),
      total,
    };
  }

  async updateTerm(id: string, data: UpdateBusinessTerm): Promise<BusinessTerm> {
    // Build update data without undefined values
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData['name'] = data.name;
    if (data.definition !== undefined) updateData['definition'] = data.definition;
    if (data.domainId !== undefined) updateData['domainId'] = data.domainId;
    if (data.ownerId !== undefined) updateData['ownerId'] = data.ownerId;
    if (data.status !== undefined) updateData['status'] = data.status;
    if (data.synonyms !== undefined) updateData['synonyms'] = data.synonyms;
    if (data.relatedTerms !== undefined) updateData['relatedTerms'] = data.relatedTerms;

    const term = await prisma.businessTerm.update({
      where: { id },
      data: updateData as Parameters<typeof prisma.businessTerm.update>[0]['data'],
    });

    return this.mapTerm(term);
  }

  async deprecateTerm(id: string, replacementTermId?: string): Promise<BusinessTerm> {
    // Build update data without undefined values
    const updateData: Record<string, unknown> = { status: 'DEPRECATED' };
    if (replacementTermId) {
      updateData['relatedTerms'] = { push: replacementTermId };
    }

    const term = await prisma.businessTerm.update({
      where: { id },
      data: updateData as Parameters<typeof prisma.businessTerm.update>[0]['data'],
    });

    // TODO: Create notifications for users who have assets mapped to this term
    // This would be implemented with a notification service

    return this.mapTerm(term);
  }

  async deleteTerm(id: string): Promise<void> {
    // Mappings will be cascade deleted due to foreign key
    await prisma.businessTerm.delete({
      where: { id },
    });
  }

  // =====================
  // Semantic Mapping Operations
  // =====================

  async createMapping(data: CreateSemanticMapping, userId: string): Promise<SemanticMapping> {
    // Validate term exists
    const term = await prisma.businessTerm.findUnique({
      where: { id: data.businessTermId },
    });
    if (!term) {
      throw new Error('Business term not found');
    }

    // Validate asset exists
    const asset = await prisma.asset.findUnique({
      where: { id: data.assetId },
    });
    if (!asset) {
      throw new Error('Asset not found');
    }

    // Build create data without undefined values
    const createData: Record<string, unknown> = {
      businessTermId: data.businessTermId,
      assetId: data.assetId,
      mappingType: data.mappingType ?? 'EXACT',
      confidence: data.confidence ?? 1.0,
      createdById: userId,
    };
    if (data.columnName !== undefined) createData['columnName'] = data.columnName;
    if (data.description !== undefined) createData['description'] = data.description;

    const mapping = await prisma.semanticMapping.create({
      data: createData as Parameters<typeof prisma.semanticMapping.create>[0]['data'],
    });

    return this.mapSemanticMapping(mapping);
  }

  async getMapping(id: string): Promise<SemanticMapping | null> {
    const mapping = await prisma.semanticMapping.findUnique({
      where: { id },
    });
    return mapping ? this.mapSemanticMapping(mapping) : null;
  }

  async getMappingsForTerm(termId: string): Promise<SemanticMapping[]> {
    const mappings = await prisma.semanticMapping.findMany({
      where: { businessTermId: termId },
      include: {
        asset: {
          select: { id: true, name: true, assetType: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return mappings.map(this.mapSemanticMapping);
  }

  async getMappingsForAsset(assetId: string): Promise<AssetWithBusinessTerms> {
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: { id: true, name: true },
    });

    if (!asset) {
      throw new Error('Asset not found');
    }

    const mappings = await prisma.semanticMapping.findMany({
      where: { assetId },
      include: {
        businessTerm: {
          include: {
            domain: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      assetId: asset.id,
      assetName: asset.name,
      terms: mappings.map((m) => ({
        term: this.mapTerm(m.businessTerm),
        mapping: this.mapSemanticMapping(m),
      })),
    };
  }

  async deleteMapping(id: string): Promise<void> {
    await prisma.semanticMapping.delete({
      where: { id },
    });
  }

  async getTermsForAsset(assetId: string): Promise<BusinessTerm[]> {
    const mappings = await prisma.semanticMapping.findMany({
      where: { assetId },
      include: {
        businessTerm: true,
      },
    });
    return mappings.map((m) => this.mapTerm(m.businessTerm));
  }

  async getAssetsForTerm(termId: string): Promise<Array<{ id: string; name: string; assetType: string; columnName?: string }>> {
    const mappings = await prisma.semanticMapping.findMany({
      where: { businessTermId: termId },
      include: {
        asset: {
          select: { id: true, name: true, assetType: true },
        },
      },
    });

    return mappings.map((m) => {
      const result: { id: string; name: string; assetType: string; columnName?: string } = {
        id: m.asset.id,
        name: m.asset.name,
        assetType: m.asset.assetType,
      };
      if (m.columnName !== null) {
        result.columnName = m.columnName;
      }
      return result;
    });
  }

  // =====================
  // Private Mappers
  // =====================

  private mapDomain(domain: {
    id: string;
    name: string;
    description: string | null;
    parentId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): BusinessDomain {
    return {
      id: domain.id,
      name: domain.name,
      description: domain.description ?? undefined,
      parentId: domain.parentId ?? undefined,
      createdAt: domain.createdAt,
      updatedAt: domain.updatedAt,
    };
  }

  private mapTerm(term: {
    id: string;
    name: string;
    definition: string;
    domainId: string;
    ownerId: string;
    status: string;
    synonyms: string[];
    relatedTerms: string[];
    createdAt: Date;
    updatedAt: Date;
  }): BusinessTerm {
    return {
      id: term.id,
      name: term.name,
      definition: term.definition,
      domainId: term.domainId,
      ownerId: term.ownerId,
      status: term.status as 'DRAFT' | 'APPROVED' | 'DEPRECATED',
      synonyms: term.synonyms,
      relatedTerms: term.relatedTerms,
      createdAt: term.createdAt,
      updatedAt: term.updatedAt,
    };
  }

  private mapSemanticMapping(mapping: {
    id: string;
    businessTermId: string;
    assetId: string;
    columnName: string | null;
    mappingType: string;
    confidence: number;
    description: string | null;
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
  }): SemanticMapping {
    return {
      id: mapping.id,
      businessTermId: mapping.businessTermId,
      assetId: mapping.assetId,
      columnName: mapping.columnName ?? undefined,
      mappingType: mapping.mappingType as 'EXACT' | 'CONTAINS' | 'DERIVES' | 'RELATED',
      confidence: mapping.confidence,
      description: mapping.description ?? undefined,
      createdById: mapping.createdById,
      createdAt: mapping.createdAt,
      updatedAt: mapping.updatedAt,
    };
  }
}

export const glossaryService = new GlossaryService();
