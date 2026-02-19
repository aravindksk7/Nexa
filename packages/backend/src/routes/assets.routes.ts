import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { catalogService } from '../services/catalog.service.js';
import { authenticate, asyncHandler, validate } from '../middleware/index.js';
import {
  CreateAssetSchema,
  UpdateAssetSchema,
  CreateSchemaSchema,
  AssetFiltersSchema,
  PaginationSchema,
} from '../models/index.js';

export const assetsRouter = Router();

// All routes require authentication
assetsRouter.use(authenticate);

// GET /api/v1/assets - List assets with filtering and pagination
assetsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const filters = AssetFiltersSchema.parse(req.query);
    const pagination = PaginationSchema.parse(req.query);
    const result = await catalogService.listAssets(filters, pagination);
    res.json(result);
  })
);

// POST /api/v1/assets - Create a new asset
assetsRouter.post(
  '/',
  validate([
    body('name').notEmpty().withMessage('Name is required'),
    body('assetType').notEmpty().withMessage('Asset type is required'),
  ]),
  asyncHandler(async (req, res) => {
    const data = CreateAssetSchema.parse(req.body);
    const asset = await catalogService.createAsset(data, req.user!.id);
    res.status(201).json({ asset });
  })
);

// GET /api/v1/assets/:id - Get a single asset
assetsRouter.get(
  '/:id',
  validate([param('id').notEmpty().withMessage('Asset ID is required')]),
  asyncHandler(async (req, res) => {
    const asset = await catalogService.getAsset(req.params['id']!);
    res.json({ asset });
  })
);

// PUT /api/v1/assets/:id - Update an asset
assetsRouter.put(
  '/:id',
  validate([param('id').notEmpty().withMessage('Asset ID is required')]),
  asyncHandler(async (req, res) => {
    const data = UpdateAssetSchema.parse(req.body);
    const asset = await catalogService.updateAsset(req.params['id']!, data, req.user!.id);
    res.json({ asset });
  })
);

// DELETE /api/v1/assets/:id - Delete an asset
assetsRouter.delete(
  '/:id',
  validate([param('id').notEmpty().withMessage('Asset ID is required')]),
  asyncHandler(async (req, res) => {
    await catalogService.deleteAsset(req.params['id']!, req.user!.id);
    res.status(204).send();
  })
);

// GET /api/v1/assets/:id/history - Get asset version history
assetsRouter.get(
  '/:id/history',
  validate([param('id').notEmpty().withMessage('Asset ID is required')]),
  asyncHandler(async (req, res) => {
    const history = await catalogService.getAssetHistory(req.params['id']!);
    res.json({ history });
  })
);

// GET /api/v1/assets/:id/versions/:v1/compare/:v2 - Compare two versions
assetsRouter.get(
  '/:id/versions/:v1/compare/:v2',
  validate([
    param('id').notEmpty().withMessage('Asset ID is required'),
    param('v1').isInt({ min: 1 }).withMessage('Valid version number required'),
    param('v2').isInt({ min: 1 }).withMessage('Valid version number required'),
  ]),
  asyncHandler(async (req, res) => {
    const comparison = await catalogService.compareVersions(
      req.params['id']!,
      parseInt(req.params['v1']!, 10),
      parseInt(req.params['v2']!, 10)
    );
    res.json({ comparison });
  })
);

// POST /api/v1/assets/:id/versions/:version/restore - Restore a version
assetsRouter.post(
  '/:id/versions/:version/restore',
  validate([
    param('id').notEmpty().withMessage('Asset ID is required'),
    param('version').isInt({ min: 1 }).withMessage('Valid version number required'),
  ]),
  asyncHandler(async (req, res) => {
    const asset = await catalogService.restoreVersion(
      req.params['id']!,
      parseInt(req.params['version']!, 10),
      req.user!.id
    );
    res.json({ asset });
  })
);

// GET /api/v1/assets/:id/schemas - Get all schemas for an asset
assetsRouter.get(
  '/:id/schemas',
  validate([param('id').notEmpty().withMessage('Asset ID is required')]),
  asyncHandler(async (req, res) => {
    const schemas = await catalogService.getSchemas(req.params['id']!);
    res.json({ schemas });
  })
);

// POST /api/v1/assets/:id/schemas - Register a new schema version
assetsRouter.post(
  '/:id/schemas',
  validate([
    param('id').notEmpty().withMessage('Asset ID is required'),
    body('schemaFormat').notEmpty().withMessage('Schema format is required'),
    body('schemaDefinition').notEmpty().withMessage('Schema definition is required'),
  ]),
  asyncHandler(async (req, res) => {
    const data = CreateSchemaSchema.parse(req.body);
    const schema = await catalogService.registerSchema(req.params['id']!, data, req.user!.id);
    res.status(201).json({ schema });
  })
);

// GET /api/v1/assets/:id/schemas/:version - Get a specific schema version
assetsRouter.get(
  '/:id/schemas/:version',
  validate([
    param('id').notEmpty().withMessage('Asset ID is required'),
    param('version').isInt({ min: 1 }).withMessage('Valid version number is required'),
  ]),
  asyncHandler(async (req, res) => {
    const schema = await catalogService.getSchemaVersion(
      req.params['id']!,
      parseInt(req.params['version']!, 10)
    );
    res.json({ schema });
  })
);

// GET /api/v1/assets/:id/preview - Get data preview
assetsRouter.get(
  '/:id/preview',
  validate([param('id').notEmpty().withMessage('Asset ID is required')]),
  asyncHandler(async (req, res) => {
    const limit = parseInt(req.query['limit'] as string) || 100;
    const preview = await catalogService.getDataPreview(req.params['id']!, limit);
    res.json(preview);
  })
);

// GET /api/v1/assets/:id/profile - Get data profiling statistics
assetsRouter.get(
  '/:id/profile',
  validate([param('id').notEmpty().withMessage('Asset ID is required')]),
  asyncHandler(async (req, res) => {
    const profile = await catalogService.getDataProfile(req.params['id']!);
    res.json(profile);
  })
);

// POST /api/v1/assets/:id/profile - Trigger data profiling
assetsRouter.post(
  '/:id/profile',
  validate([param('id').notEmpty().withMessage('Asset ID is required')]),
  asyncHandler(async (req, res) => {
    const profile = await catalogService.getDataProfile(req.params['id']!);
    res.json(profile);
  })
);
