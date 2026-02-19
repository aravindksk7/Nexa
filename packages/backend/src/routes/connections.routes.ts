import { Router } from 'express';
import { body, param } from 'express-validator';
import { dataConnectorService } from '../services/dataConnector.service.js';
import { authenticate, asyncHandler, validate } from '../middleware/index.js';
import { CreateConnectionSchema } from '../models/index.js';

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
