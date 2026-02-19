import { CatalogService } from '../../src/services/catalog.service';
import { prisma } from '../../src/lib/prisma';

// Mock Prisma
jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    asset: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    assetVersion: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    schema: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

describe('CatalogService', () => {
  let catalogService: CatalogService;
  const userId = 'user-123';

  beforeEach(() => {
    catalogService = new CatalogService();
    jest.clearAllMocks();
  });

  describe('createAsset', () => {
    const validAssetData = {
      name: 'customers_table',
      description: 'Customer data table',
      assetType: 'TABLE' as const,
      domain: 'Sales',
      tags: ['customers', 'sales'],
    };

    it('should create a new asset with valid data', async () => {
      const mockAsset = {
        id: 'asset-123',
        ...validAssetData,
        ownerId: userId,
        createdById: userId,
        updatedById: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.asset.create as jest.Mock).mockResolvedValue(mockAsset);
      (prisma.assetVersion.create as jest.Mock).mockResolvedValue({});

      const result = await catalogService.createAsset(validAssetData, userId);

      expect(result).toHaveProperty('id', 'asset-123');
      expect(result).toHaveProperty('name', validAssetData.name);
      expect(result).toHaveProperty('assetType', 'TABLE');
      expect(prisma.asset.create).toHaveBeenCalledTimes(1);
      expect(prisma.assetVersion.create).toHaveBeenCalledTimes(1);
    });

    it('should create asset without optional fields', async () => {
      const minimalData = {
        name: 'minimal_asset',
        assetType: 'TABLE' as const,
      };

      const mockAsset = {
        id: 'asset-456',
        ...minimalData,
        description: null,
        domain: null,
        tags: [],
        customProperties: {},
        ownerId: userId,
        createdById: userId,
        updatedById: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.asset.create as jest.Mock).mockResolvedValue(mockAsset);
      (prisma.assetVersion.create as jest.Mock).mockResolvedValue({});

      const result = await catalogService.createAsset(minimalData, userId);

      expect(result).toHaveProperty('name', 'minimal_asset');
      expect(result.tags).toEqual([]);
    });

    it('should preserve custom properties when creating asset', async () => {
      const dataWithCustomProps = {
        ...validAssetData,
        customProperties: {
          source: 'ETL Pipeline',
          refreshFrequency: 'daily',
        },
      };

      const mockAsset = {
        id: 'asset-789',
        ...dataWithCustomProps,
        ownerId: userId,
        createdById: userId,
        updatedById: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.asset.create as jest.Mock).mockResolvedValue(mockAsset);
      (prisma.assetVersion.create as jest.Mock).mockResolvedValue({});

      const result = await catalogService.createAsset(dataWithCustomProps, userId);

      expect(result.customProperties).toEqual(dataWithCustomProps.customProperties);
    });
  });

  describe('getAsset', () => {
    it('should return asset by id', async () => {
      const mockAsset = {
        id: 'asset-123',
        name: 'test_table',
        assetType: 'TABLE',
        owner: { id: 'user-123', username: 'admin', email: 'admin@test.com' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.asset.findUnique as jest.Mock).mockResolvedValue(mockAsset);

      const result = await catalogService.getAsset('asset-123');

      expect(result).toHaveProperty('id', 'asset-123');
      expect(result).toHaveProperty('name', 'test_table');
    });

    it('should throw NotFoundError for non-existent asset', async () => {
      (prisma.asset.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(catalogService.getAsset('nonexistent-id')).rejects.toThrow();
    });
  });

  describe('listAssets', () => {
    it('should list assets with pagination', async () => {
      const mockAssets = [
        { id: 'asset-1', name: 'table_1', assetType: 'TABLE' },
        { id: 'asset-2', name: 'table_2', assetType: 'TABLE' },
      ];

      (prisma.asset.findMany as jest.Mock).mockResolvedValue(mockAssets);
      (prisma.asset.count as jest.Mock).mockResolvedValue(10);

      const result = await catalogService.listAssets({}, { page: 1, limit: 10 });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
      expect(result.data).toHaveLength(2);
    });

    it('should filter assets by type', async () => {
      const mockAssets = [
        { id: 'asset-1', name: 'dataset_1', assetType: 'DATASET' },
      ];

      (prisma.asset.findMany as jest.Mock).mockResolvedValue(mockAssets);
      (prisma.asset.count as jest.Mock).mockResolvedValue(1);

      const result = await catalogService.listAssets(
        { assetType: 'DATASET' },
        { page: 1, limit: 10 }
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].assetType).toBe('DATASET');
    });

    it('should filter assets by domain', async () => {
      (prisma.asset.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.asset.count as jest.Mock).mockResolvedValue(0);

      await catalogService.listAssets({ domain: 'Sales' }, { page: 1, limit: 10 });

      expect(prisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ domain: 'Sales' }),
        })
      );
    });

    it('should filter assets by search query', async () => {
      (prisma.asset.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.asset.count as jest.Mock).mockResolvedValue(0);

      await catalogService.listAssets({ search: 'customer' }, { page: 1, limit: 10 });

      expect(prisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { name: expect.any(Object) },
              { description: expect.any(Object) },
            ]),
          }),
        })
      );
    });
  });

  describe('updateAsset', () => {
    it('should update asset fields', async () => {
      const existingAsset = {
        id: 'asset-123',
        name: 'original_name',
        description: 'Original description',
        assetType: 'TABLE',
        tags: ['original'],
        version: 1,
      };

      const updatedAsset = {
        ...existingAsset,
        description: 'Updated description',
        tags: ['original', 'updated'],
        version: 2,
      };

      (prisma.asset.findUnique as jest.Mock).mockResolvedValue(existingAsset);
      (prisma.asset.update as jest.Mock).mockResolvedValue(updatedAsset);
      (prisma.assetVersion.create as jest.Mock).mockResolvedValue({});

      const result = await catalogService.updateAsset(
        'asset-123',
        { description: 'Updated description', tags: ['original', 'updated'] },
        userId
      );

      expect(result).toHaveProperty('description', 'Updated description');
      expect(prisma.assetVersion.create).toHaveBeenCalled();
    });

    it('should throw NotFoundError when updating non-existent asset', async () => {
      (prisma.asset.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        catalogService.updateAsset('nonexistent', { description: 'Update' }, userId)
      ).rejects.toThrow();
    });
  });

  describe('deleteAsset', () => {
    it('should delete an existing asset', async () => {
      const mockAsset = { id: 'asset-123', name: 'to_delete' };

      (prisma.asset.findUnique as jest.Mock).mockResolvedValue(mockAsset);
      (prisma.asset.delete as jest.Mock).mockResolvedValue(mockAsset);

      await expect(catalogService.deleteAsset('asset-123')).resolves.not.toThrow();
      expect(prisma.asset.delete).toHaveBeenCalledWith({ where: { id: 'asset-123' } });
    });

    it('should throw NotFoundError when deleting non-existent asset', async () => {
      (prisma.asset.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(catalogService.deleteAsset('nonexistent')).rejects.toThrow();
    });
  });

  describe('asset types validation', () => {
    const validTypes = ['TABLE', 'VIEW', 'COLUMN', 'DATASET', 'PIPELINE', 'DASHBOARD', 'REPORT'];

    it.each(validTypes)('should create asset with type %s', async (assetType) => {
      const mockAsset = {
        id: 'asset-123',
        name: `test_${assetType.toLowerCase()}`,
        assetType,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.asset.create as jest.Mock).mockResolvedValue(mockAsset);
      (prisma.assetVersion.create as jest.Mock).mockResolvedValue({});

      const result = await catalogService.createAsset(
        { name: `test_${assetType.toLowerCase()}`, assetType: assetType as any },
        userId
      );

      expect(result.assetType).toBe(assetType);
    });
  });
});
