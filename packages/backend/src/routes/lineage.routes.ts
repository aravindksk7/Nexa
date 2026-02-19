import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { lineageService } from '../services/lineage.service.js';
import { authenticate, asyncHandler, validate } from '../middleware/index.js';
import { CreateLineageEdgeSchema } from '../models/index.js';

export const lineageRouter = Router();

// All routes require authentication
lineageRouter.use(authenticate);

// POST /api/v1/lineage/events - Ingest an OpenLineage event
lineageRouter.post(
  '/events',
  asyncHandler(async (req, res) => {
    await lineageService.ingestLineageEvent(req.body);
    res.status(202).json({ message: 'Lineage event accepted' });
  })
);

// POST /api/v1/lineage/sql - Parse SQL for lineage extraction
lineageRouter.post(
  '/sql',
  validate([
    body('sql').notEmpty().withMessage('SQL query is required'),
  ]),
  asyncHandler(async (req, res) => {
    const { sql, dialect } = req.body;
    const lineage = await lineageService.parseSqlLineage(sql, dialect ?? 'postgresql');
    res.json({ lineage });
  })
);

// POST /api/v1/lineage/edges - Create a lineage edge
lineageRouter.post(
  '/edges',
  validate([
    body('sourceAssetId').isUUID().withMessage('Valid source asset ID is required'),
    body('targetAssetId').isUUID().withMessage('Valid target asset ID is required'),
    body('transformationType').notEmpty().withMessage('Transformation type is required'),
  ]),
  asyncHandler(async (req, res) => {
    const data = CreateLineageEdgeSchema.parse(req.body);
    const edge = await lineageService.createLineageEdge(data);
    res.status(201).json({ edge });
  })
);

// GET /api/v1/lineage/:id/upstream - Get upstream lineage
lineageRouter.get(
  '/:id/upstream',
  validate([
    param('id').isUUID().withMessage('Valid asset ID is required'),
    query('depth').optional().isInt({ min: 1, max: 50 }).withMessage('Depth must be between 1 and 50'),
  ]),
  asyncHandler(async (req, res) => {
    const depth = req.query['depth'] ? parseInt(req.query['depth'] as string, 10) : 5;
    const lineage = await lineageService.getUpstreamLineage(req.params['id']!, depth);
    res.json({ lineage });
  })
);

// GET /api/v1/lineage/:id/downstream - Get downstream lineage
lineageRouter.get(
  '/:id/downstream',
  validate([
    param('id').isUUID().withMessage('Valid asset ID is required'),
    query('depth').optional().isInt({ min: 1, max: 50 }).withMessage('Depth must be between 1 and 50'),
  ]),
  asyncHandler(async (req, res) => {
    const depth = req.query['depth'] ? parseInt(req.query['depth'] as string, 10) : 5;
    const lineage = await lineageService.getDownstreamLineage(req.params['id']!, depth);
    res.json({ lineage });
  })
);

// GET /api/v1/lineage/:id/impact - Perform impact analysis
lineageRouter.get(
  '/:id/impact',
  validate([
    param('id').isUUID().withMessage('Valid asset ID is required'),
    query('maxDepth').optional().isInt({ min: 1, max: 100 }).withMessage('Max depth must be between 1 and 100'),
  ]),
  asyncHandler(async (req, res) => {
    const maxDepth = req.query['maxDepth'] ? parseInt(req.query['maxDepth'] as string, 10) : 10;
    const impact = await lineageService.performImpactAnalysis(req.params['id']!, maxDepth);
    res.json({ impact });
  })
);
