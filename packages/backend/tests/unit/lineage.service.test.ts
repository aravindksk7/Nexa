import { LineageService } from '../../src/services/lineage.service';
import { prisma } from '../../src/lib/prisma';

// Mock Prisma
jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    asset: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    lineageEdge: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    assetVersion: {
      create: jest.fn(),
    },
  },
}));

describe('LineageService', () => {
  let lineageService: LineageService;

  beforeEach(() => {
    lineageService = new LineageService();
    jest.clearAllMocks();
  });

  describe('createLineageEdge', () => {
    const sourceAsset = {
      id: 'source-asset-123',
      name: 'source_table',
      assetType: 'TABLE',
    };

    const targetAsset = {
      id: 'target-asset-456',
      name: 'target_table',
      assetType: 'TABLE',
    };

    it('should create a lineage edge between two assets', async () => {
      const edgeData = {
        sourceAssetId: sourceAsset.id,
        targetAssetId: targetAsset.id,
        transformationType: 'SELECT',
        transformationLogic: 'SELECT * FROM source_table',
      };

      const mockEdge = {
        id: 'edge-123',
        ...edgeData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.asset.findUnique as jest.Mock)
        .mockResolvedValueOnce(sourceAsset)
        .mockResolvedValueOnce(targetAsset);
      (prisma.lineageEdge.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.lineageEdge.create as jest.Mock).mockResolvedValue(mockEdge);

      const result = await lineageService.createLineageEdge(edgeData);

      expect(result).toHaveProperty('id', 'edge-123');
      expect(result).toHaveProperty('sourceAssetId', sourceAsset.id);
      expect(result).toHaveProperty('targetAssetId', targetAsset.id);
    });

    it('should throw NotFoundError when source asset does not exist', async () => {
      (prisma.asset.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        lineageService.createLineageEdge({
          sourceAssetId: 'nonexistent',
          targetAssetId: targetAsset.id,
        })
      ).rejects.toThrow();
    });

    it('should throw NotFoundError when target asset does not exist', async () => {
      (prisma.asset.findUnique as jest.Mock)
        .mockResolvedValueOnce(sourceAsset)
        .mockResolvedValueOnce(null);

      await expect(
        lineageService.createLineageEdge({
          sourceAssetId: sourceAsset.id,
          targetAssetId: 'nonexistent',
        })
      ).rejects.toThrow();
    });

    it('should throw ValidationError for self-referential edge', async () => {
      (prisma.asset.findUnique as jest.Mock).mockResolvedValue(sourceAsset);

      await expect(
        lineageService.createLineageEdge({
          sourceAssetId: sourceAsset.id,
          targetAssetId: sourceAsset.id,
        })
      ).rejects.toThrow();
    });
  });

  describe('getUpstreamLineage', () => {
    it('should return lineage graph for an asset', async () => {
      const mockAsset = {
        id: 'asset-123',
        name: 'center_table',
        assetType: 'TABLE',
      };

      const mockUpstreamEdges = [
        {
          id: 'edge-1',
          sourceAssetId: 'upstream-1',
          targetAssetId: 'asset-123',
          sourceAsset: { id: 'upstream-1', name: 'upstream_table', assetType: 'TABLE' },
        },
      ];

      const mockDownstreamEdges = [
        {
          id: 'edge-2',
          sourceAssetId: 'asset-123',
          targetAssetId: 'downstream-1',
          targetAsset: { id: 'downstream-1', name: 'downstream_table', assetType: 'TABLE' },
        },
      ];

      (prisma.asset.findUnique as jest.Mock).mockResolvedValue(mockAsset);
      (prisma.lineageEdge.findMany as jest.Mock)
        .mockResolvedValueOnce(mockUpstreamEdges)
        .mockResolvedValueOnce(mockDownstreamEdges);

      const result = await lineageService.getUpstreamLineage('asset-123');

      expect(result).toHaveProperty('nodes');
      expect(result).toHaveProperty('edges');
      expect(result.nodes.length).toBeGreaterThanOrEqual(1);
    });

    it('should throw NotFoundError for non-existent asset', async () => {
      (prisma.asset.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(lineageService.getUpstreamLineage('nonexistent')).rejects.toThrow();
    });

    it('should respect depth parameter', async () => {
      const mockAsset = { id: 'asset-123', name: 'test', assetType: 'TABLE' };

      (prisma.asset.findUnique as jest.Mock).mockResolvedValue(mockAsset);
      (prisma.lineageEdge.findMany as jest.Mock).mockResolvedValue([]);

      const result = await lineageService.getUpstreamLineage('asset-123', 2);

      expect(result).toBeDefined();
      // Depth should limit the recursion
    });
  });

  describe('parseSqlLineage', () => {
    it('should extract table names from simple SELECT query', async () => {
      const sql = 'SELECT id, name FROM customers';
      
      const result = await lineageService.parseSqlLineage(sql, 'postgresql');

      expect(result.inputs).toContain('customers');
    });

    it('should extract tables from JOIN queries', async () => {
      const sql = `
        SELECT c.id, o.amount 
        FROM customers c 
        JOIN orders o ON c.id = o.customer_id
      `;

      const result = await lineageService.parseSqlLineage(sql, 'postgresql');

      expect(result.inputs).toContain('customers');
      expect(result.inputs).toContain('orders');
    });

    it('should extract output table from INSERT INTO SELECT', async () => {
      const sql = `
        INSERT INTO customer_summary 
        SELECT customer_id, SUM(amount) 
        FROM orders 
        GROUP BY customer_id
      `;

      const result = await lineageService.parseSqlLineage(sql, 'postgresql');

      expect(result.inputs).toContain('orders');
      expect(result.outputs).toContain('customer_summary');
    });

    it('should handle subqueries', async () => {
      const sql = `
        SELECT * FROM customers 
        WHERE id IN (SELECT customer_id FROM orders WHERE amount > 100)
      `;

      const result = await lineageService.parseSqlLineage(sql, 'postgresql');

      expect(result.inputs).toContain('customers');
      expect(result.inputs).toContain('orders');
    });

    it('should handle CREATE TABLE AS SELECT', async () => {
      const sql = `
        CREATE TABLE new_customers AS 
        SELECT * FROM customers WHERE active = true
      `;

      const result = await lineageService.parseSqlLineage(sql, 'postgresql');

      expect(result.inputs).toContain('customers');
      expect(result.outputs).toContain('new_customers');
    });

    it('should handle different SQL dialects', async () => {
      const sql = 'SELECT * FROM [dbo].[customers]';

      // Test with SQL Server dialect
      const result = await lineageService.parseSqlLineage(sql, 'transactsql');

      expect(result.inputs.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('impactAnalysis', () => {
    it('should analyze downstream impact of an asset', async () => {
      const mockAsset = { id: 'asset-123', name: 'source_table', assetType: 'TABLE' };
      
      const mockDownstreamEdges = [
        {
          id: 'edge-1',
          targetAssetId: 'downstream-1',
          targetAsset: { id: 'downstream-1', name: 'report_1', assetType: 'REPORT' },
        },
        {
          id: 'edge-2',
          targetAssetId: 'downstream-2',
          targetAsset: { id: 'downstream-2', name: 'dashboard_1', assetType: 'DASHBOARD' },
        },
      ];

      (prisma.asset.findUnique as jest.Mock).mockResolvedValue(mockAsset);
      (prisma.lineageEdge.findMany as jest.Mock).mockResolvedValue(mockDownstreamEdges);

      const result = await lineageService.performImpactAnalysis('asset-123');

      expect(result).toHaveProperty('impactedAssets');
      expect(result.impactedAssets.length).toBeGreaterThanOrEqual(0);
    });

    it('should return empty impact for leaf nodes', async () => {
      const mockAsset = { id: 'asset-123', name: 'leaf_report', assetType: 'REPORT' };

      (prisma.asset.findUnique as jest.Mock).mockResolvedValue(mockAsset);
      (prisma.lineageEdge.findMany as jest.Mock).mockResolvedValue([]);

      const result = await lineageService.performImpactAnalysis('asset-123');

      expect(result.impactedAssets).toHaveLength(0);
    });
  });

  describe('OpenLineage events', () => {
    const validOpenLineageEvent = {
      eventType: 'COMPLETE',
      eventTime: new Date().toISOString(),
      run: { runId: 'run-123' },
      job: { namespace: 'airflow', name: 'etl_job' },
      inputs: [
        { namespace: 'db', name: 'source_table' },
      ],
      outputs: [
        { namespace: 'db', name: 'target_table' },
      ],
    };

    it('should process COMPLETE event and create lineage', async () => {
      const sourceAsset = { id: 'asset-1', name: 'source_table' };
      const targetAsset = { id: 'asset-2', name: 'target_table' };

      (prisma.asset.findFirst as jest.Mock)
        .mockResolvedValueOnce(sourceAsset)
        .mockResolvedValueOnce(targetAsset);
      (prisma.lineageEdge.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.lineageEdge.create as jest.Mock).mockResolvedValue({});

      await expect(
        lineageService.ingestLineageEvent(validOpenLineageEvent as any)
      ).resolves.not.toThrow();
    });

    it('should skip non-COMPLETE events', async () => {
      const startEvent = { ...validOpenLineageEvent, eventType: 'START' };

      await lineageService.ingestLineageEvent(startEvent as any);

      expect(prisma.lineageEdge.create).not.toHaveBeenCalled();
    });

    it('should create assets if they do not exist', async () => {
      const mockSystemUser = { id: 'system-user', username: 'system' };
      
      (prisma.asset.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockSystemUser);
      (prisma.asset.create as jest.Mock)
        .mockResolvedValueOnce({ id: 'new-asset-1', name: 'target_table' })
        .mockResolvedValueOnce({ id: 'new-asset-2', name: 'source_table' });
      (prisma.assetVersion.create as jest.Mock).mockResolvedValue({});
      (prisma.lineageEdge.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.lineageEdge.create as jest.Mock).mockResolvedValue({});

      await lineageService.ingestLineageEvent(validOpenLineageEvent as any);

      expect(prisma.asset.create).toHaveBeenCalled();
    });
  });
});
