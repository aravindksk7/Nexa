import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { columnLineageService } from '../services/columnLineage.service.js';
import { authenticate, asyncHandler, validate } from '../middleware/index.js';
import { CreateColumnLineageEdgeSchema } from '../models/index.js';

export const columnLineageRouter = Router();

// All routes require authentication
columnLineageRouter.use(authenticate);

// =====================
// Column Lineage Edge Routes
// =====================

// POST /api/v1/lineage/columns - Create column lineage edge
columnLineageRouter.post(
  '/',
  validate([
    body('sourceAssetId').isUUID().withMessage('Valid source asset ID is required'),
    body('sourceColumn').notEmpty().withMessage('Source column is required'),
    body('targetAssetId').isUUID().withMessage('Valid target asset ID is required'),
    body('targetColumn').notEmpty().withMessage('Target column is required'),
    body('transformationType').isIn(['DIRECT', 'DERIVED', 'AGGREGATED', 'FILTERED', 'JOINED', 'CASE', 'COALESCED'])
      .withMessage('Valid transformation type is required'),
  ]),
  asyncHandler(async (req, res) => {
    const data = CreateColumnLineageEdgeSchema.parse(req.body);
    const edge = await columnLineageService.createColumnLineageEdge(data);
    res.status(201).json({ edge });
  })
);

// GET /api/v1/lineage/columns/:id - Get column lineage edge by ID
columnLineageRouter.get(
  '/:id',
  validate([
    param('id').isUUID().withMessage('Valid edge ID is required'),
  ]),
  asyncHandler(async (req, res) => {
    const edge = await columnLineageService.getColumnLineageEdge(req.params['id']!);
    if (!edge) {
      res.status(404).json({ error: 'Column lineage edge not found' });
      return;
    }
    res.json({ edge });
  })
);

// DELETE /api/v1/lineage/columns/:id - Delete column lineage edge
columnLineageRouter.delete(
  '/:id',
  validate([
    param('id').isUUID().withMessage('Valid edge ID is required'),
  ]),
  asyncHandler(async (req, res) => {
    await columnLineageService.deleteColumnLineageEdge(req.params['id']!);
    res.status(204).send();
  })
);

// GET /api/v1/lineage/columns/asset/:assetId - Get all column lineage for an asset
columnLineageRouter.get(
  '/asset/:assetId',
  validate([
    param('assetId').isUUID().withMessage('Valid asset ID is required'),
  ]),
  asyncHandler(async (req, res) => {
    const edges = await columnLineageService.getColumnLineageForAsset(req.params['assetId']!);
    res.json({ edges });
  })
);

// =====================
// Column Lineage Traversal Routes
// =====================

// GET /api/v1/lineage/columns/:assetId/:column/upstream - Get upstream column lineage
columnLineageRouter.get(
  '/:assetId/:column/upstream',
  validate([
    param('assetId').isUUID().withMessage('Valid asset ID is required'),
    param('column').notEmpty().withMessage('Column name is required'),
    query('depth').optional().isInt({ min: 1, max: 50 }).withMessage('Depth must be between 1 and 50'),
  ]),
  asyncHandler(async (req, res) => {
    const depth = req.query['depth'] ? parseInt(req.query['depth'] as string, 10) : 5;
    const lineage = await columnLineageService.getColumnUpstreamLineage(
      req.params['assetId']!,
      req.params['column']!,
      depth
    );
    res.json({ lineage });
  })
);

// GET /api/v1/lineage/columns/:assetId/:column/downstream - Get downstream column lineage
columnLineageRouter.get(
  '/:assetId/:column/downstream',
  validate([
    param('assetId').isUUID().withMessage('Valid asset ID is required'),
    param('column').notEmpty().withMessage('Column name is required'),
    query('depth').optional().isInt({ min: 1, max: 50 }).withMessage('Depth must be between 1 and 50'),
  ]),
  asyncHandler(async (req, res) => {
    const depth = req.query['depth'] ? parseInt(req.query['depth'] as string, 10) : 5;
    const lineage = await columnLineageService.getColumnDownstreamLineage(
      req.params['assetId']!,
      req.params['column']!,
      depth
    );
    res.json({ lineage });
  })
);

// GET /api/v1/lineage/columns/:assetId/:column/impact - Column impact analysis
columnLineageRouter.get(
  '/:assetId/:column/impact',
  validate([
    param('assetId').isUUID().withMessage('Valid asset ID is required'),
    param('column').notEmpty().withMessage('Column name is required'),
    query('maxDepth').optional().isInt({ min: 1, max: 100 }).withMessage('Max depth must be between 1 and 100'),
  ]),
  asyncHandler(async (req, res) => {
    const maxDepth = req.query['maxDepth'] ? parseInt(req.query['maxDepth'] as string, 10) : 10;
    const impact = await columnLineageService.performColumnImpactAnalysis(
      req.params['assetId']!,
      req.params['column']!,
      maxDepth
    );
    res.json({ impact });
  })
);

// =====================
// SQL Parsing for Column Lineage
// =====================

// POST /api/v1/lineage/columns/parse-sql - Parse SQL for column lineage
columnLineageRouter.post(
  '/parse-sql',
  validate([
    body('sql').notEmpty().withMessage('SQL query is required'),
  ]),
  asyncHandler(async (req, res) => {
    const { sql, dialect } = req.body;
    const result = await columnLineageService.parseSqlColumnLineage(sql, dialect ?? 'postgresql');
    res.json(result);
  })
);
