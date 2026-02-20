import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { dataConnectorService } from '../services/dataConnector.service.js';
import { authenticate, asyncHandler, validate } from '../middleware/index.js';
import { CreateConnectionSchema, UpdateConnectionSchema } from '../models/index.js';

export const connectionsRouter = Router();

// All routes require authentication
connectionsRouter.use(authenticate);

// GET /api/v1/connections - List all connections
connectionsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const connections = await dataConnectorService.listConnections();
    res.json({ connections });
  })
);

// POST /api/v1/connections - Create a new connection
connectionsRouter.post(
  '/',
  validate([
    body('name').notEmpty().withMessage('Name is required'),
    body('connectionType').notEmpty().withMessage('Connection type is required'),
    body('host').notEmpty().withMessage('Host is required'),
    body('port').isInt({ min: 1, max: 65535 }).withMessage('Valid port is required'),
  ]),
  asyncHandler(async (req, res) => {
    const data = CreateConnectionSchema.parse(req.body);
    const connection = await dataConnectorService.createConnection(data);
    res.status(201).json({ connection });
  })
);

// GET /api/v1/connections/:id - Get a connection
connectionsRouter.get(
  '/:id',
  validate([param('id').isUUID().withMessage('Valid connection ID is required')]),
  asyncHandler(async (req, res) => {
    const connection = await dataConnectorService.getConnection(req.params['id']!);
    res.json({ connection });
  })
);

// PUT /api/v1/connections/:id - Update a connection
connectionsRouter.put(
  '/:id',
  validate([param('id').isUUID().withMessage('Valid connection ID is required')]),
  asyncHandler(async (req, res) => {
    const data = UpdateConnectionSchema.parse(req.body);
    const connection = await dataConnectorService.updateConnection(req.params['id']!, data);
    res.json({ connection });
  })
);

// DELETE /api/v1/connections/:id - Delete a connection
connectionsRouter.delete(
  '/:id',
  validate([param('id').isUUID().withMessage('Valid connection ID is required')]),
  asyncHandler(async (req, res) => {
    await dataConnectorService.deleteConnection(req.params['id']!);
    res.status(204).send();
  })
);

// POST /api/v1/connections/:id/test - Test a connection
connectionsRouter.post(
  '/:id/test',
  validate([param('id').isUUID().withMessage('Valid connection ID is required')]),
  asyncHandler(async (req, res) => {
    const result = await dataConnectorService.testConnection(req.params['id']!);
    res.json({ result });
  })
);

// GET /api/v1/connections/:id/explore - Explore connection schema
connectionsRouter.get(
  '/:id/explore',
  validate([param('id').isUUID().withMessage('Valid connection ID is required')]),
  asyncHandler(async (req, res) => {
    const schema = await dataConnectorService.exploreSource(req.params['id']!);
    res.json({ schema });
  })
);

connectionsRouter.get(
  '/:id/sample',
  validate([
    param('id').isUUID().withMessage('Valid connection ID is required'),
    query('database').notEmpty().withMessage('Database is required'),
    query('table').notEmpty().withMessage('Table is required'),
    query('sampleMode').optional().isIn(['FIRST_N', 'RANDOM_N']).withMessage('Sample mode must be FIRST_N or RANDOM_N'),
    query('limit').optional().isInt({ min: 1, max: 5000 }).withMessage('Limit must be between 1 and 5000'),
  ]),
  asyncHandler(async (req, res) => {
    const preview = await dataConnectorService.sampleTableData(req.params['id']!, {
      database: req.query['database'] as string,
      ...(req.query['schema'] ? { schema: req.query['schema'] as string } : {}),
      table: req.query['table'] as string,
      sampleMode: (req.query['sampleMode'] as 'FIRST_N' | 'RANDOM_N' | undefined) ?? 'FIRST_N',
      limit: req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 100,
    });

    res.json({ preview });
  })
);

// POST /api/v1/connections/:id/extract - Extract metadata from connection
connectionsRouter.post(
  '/:id/extract',
  validate([param('id').isUUID().withMessage('Valid connection ID is required')]),
  asyncHandler(async (req, res) => {
    const incremental = req.body.incremental === true;
    const result = await dataConnectorService.extractMetadata(
      req.params['id']!,
      req.user!.id,
      incremental
    );
    res.json({ result });
  })
);

// GET /api/v1/connections/:id/schema-history - Get schema exploration history
connectionsRouter.get(
  '/:id/schema-history',
  validate([param('id').isUUID().withMessage('Valid connection ID is required')]),
  asyncHandler(async (req, res) => {
    const limit = parseInt(req.query['limit'] as string) || 20;
    const history = await dataConnectorService.getSchemaExplorationHistory(req.params['id']!, limit);
    res.json({ history });
  })
);

// GET /api/v1/connections/:id/sync-history - Get sync history
connectionsRouter.get(
  '/:id/sync-history',
  validate([param('id').isUUID().withMessage('Valid connection ID is required')]),
  asyncHandler(async (req, res) => {
    const limit = parseInt(req.query['limit'] as string) || 20;
    const history = await dataConnectorService.getSyncHistory(req.params['id']!, limit);
    res.json({ history });
  })
);

// GET /api/v1/connections/:id/sync-info - Get latest sync and exploration info
connectionsRouter.get(
  '/:id/sync-info',
  validate([param('id').isUUID().withMessage('Valid connection ID is required')]),
  asyncHandler(async (req, res) => {
    const info = await dataConnectorService.getLatestSyncInfo(req.params['id']!);
    res.json(info);
  })
);
