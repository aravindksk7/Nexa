import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { glossaryService } from '../services/glossary.service.js';
import { authenticate, asyncHandler, validate } from '../middleware/index.js';
import {
  CreateBusinessDomainSchema,
  CreateBusinessTermSchema,
  UpdateBusinessTermSchema,
  CreateSemanticMappingSchema,
} from '../models/index.js';

export const glossaryRouter = Router();

// All routes require authentication
glossaryRouter.use(authenticate);

// =====================
// Business Domain Routes
// =====================

// GET /api/v1/glossary/domains - List all domains
glossaryRouter.get(
  '/domains',
  validate([
    query('parentId').optional().isUUID().withMessage('Valid parent ID is required'),
  ]),
  asyncHandler(async (req, res) => {
    const parentId = req.query['parentId'] as string | undefined;
    const domains = await glossaryService.listDomains(parentId);
    res.json({ domains });
  })
);

// GET /api/v1/glossary/domains/hierarchy - Get domain hierarchy
glossaryRouter.get(
  '/domains/hierarchy',
  asyncHandler(async (_req, res) => {
    const hierarchy = await glossaryService.getDomainHierarchy();
    res.json({ domains: hierarchy });
  })
);

// GET /api/v1/glossary/domains/:id - Get domain by ID
glossaryRouter.get(
  '/domains/:id',
  validate([
    param('id').isUUID().withMessage('Valid domain ID is required'),
  ]),
  asyncHandler(async (req, res) => {
    const domain = await glossaryService.getDomain(req.params['id']!);
    if (!domain) {
      res.status(404).json({ error: 'Domain not found' });
      return;
    }
    res.json({ domain });
  })
);

// POST /api/v1/glossary/domains - Create domain
glossaryRouter.post(
  '/domains',
  validate([
    body('name').notEmpty().withMessage('Domain name is required'),
  ]),
  asyncHandler(async (req, res) => {
    const data = CreateBusinessDomainSchema.parse(req.body);
    const domain = await glossaryService.createDomain(data);
    res.status(201).json({ domain });
  })
);

// PUT /api/v1/glossary/domains/:id - Update domain
glossaryRouter.put(
  '/domains/:id',
  validate([
    param('id').isUUID().withMessage('Valid domain ID is required'),
  ]),
  asyncHandler(async (req, res) => {
    const parsed = CreateBusinessDomainSchema.partial().parse(req.body);
    // Remove undefined values to satisfy exact optional property types
    const data: Partial<{ name: string; description: string; parentId: string }> = {};
    if (parsed.name !== undefined) data.name = parsed.name;
    if (parsed.description !== undefined) data.description = parsed.description;
    if (parsed.parentId !== undefined) data.parentId = parsed.parentId;
    const domain = await glossaryService.updateDomain(req.params['id']!, data);
    res.json({ domain });
  })
);

// DELETE /api/v1/glossary/domains/:id - Delete domain
glossaryRouter.delete(
  '/domains/:id',
  validate([
    param('id').isUUID().withMessage('Valid domain ID is required'),
  ]),
  asyncHandler(async (req, res) => {
    await glossaryService.deleteDomain(req.params['id']!);
    res.status(204).send();
  })
);

// =====================
// Business Term Routes
// =====================

// GET /api/v1/glossary/terms - List terms with optional filters
glossaryRouter.get(
  '/terms',
  validate([
    query('domainId').optional().isUUID().withMessage('Valid domain ID is required'),
    query('status').optional().isIn(['DRAFT', 'APPROVED', 'DEPRECATED']).withMessage('Valid status is required'),
    query('search').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
  ]),
  asyncHandler(async (req, res) => {
    // Build options object without undefined values
    const options: { domainId?: string; status?: string; search?: string; limit?: number; offset?: number } = {};
    if (req.query['domainId']) options.domainId = req.query['domainId'] as string;
    if (req.query['status']) options.status = req.query['status'] as string;
    if (req.query['search']) options.search = req.query['search'] as string;
    if (req.query['limit']) options.limit = parseInt(req.query['limit'] as string, 10);
    if (req.query['offset']) options.offset = parseInt(req.query['offset'] as string, 10);
    const result = await glossaryService.listTerms(options);
    res.json(result);
  })
);

// GET /api/v1/glossary/terms/:id - Get term by ID
glossaryRouter.get(
  '/terms/:id',
  validate([
    param('id').isUUID().withMessage('Valid term ID is required'),
  ]),
  asyncHandler(async (req, res) => {
    const term = await glossaryService.getTerm(req.params['id']!);
    if (!term) {
      res.status(404).json({ error: 'Business term not found' });
      return;
    }
    res.json({ term });
  })
);

// POST /api/v1/glossary/terms - Create term
glossaryRouter.post(
  '/terms',
  validate([
    body('name').notEmpty().withMessage('Term name is required'),
    body('definition').notEmpty().withMessage('Term definition is required'),
    body('domainId').isUUID().withMessage('Valid domain ID is required'),
  ]),
  asyncHandler(async (req, res) => {
    const data = CreateBusinessTermSchema.parse(req.body);
    const term = await glossaryService.createTerm(data, req.user!.id);
    res.status(201).json({ term });
  })
);

// PUT /api/v1/glossary/terms/:id - Update term
glossaryRouter.put(
  '/terms/:id',
  validate([
    param('id').isUUID().withMessage('Valid term ID is required'),
  ]),
  asyncHandler(async (req, res) => {
    const data = UpdateBusinessTermSchema.parse(req.body);
    const term = await glossaryService.updateTerm(req.params['id']!, data);
    res.json({ term });
  })
);

// POST /api/v1/glossary/terms/:id/deprecate - Deprecate term
glossaryRouter.post(
  '/terms/:id/deprecate',
  validate([
    param('id').isUUID().withMessage('Valid term ID is required'),
    body('replacementTermId').optional().isUUID().withMessage('Valid replacement term ID is required'),
  ]),
  asyncHandler(async (req, res) => {
    const replacementTermId = req.body.replacementTermId as string | undefined;
    const term = await glossaryService.deprecateTerm(req.params['id']!, replacementTermId);
    res.json({ term });
  })
);

// DELETE /api/v1/glossary/terms/:id - Delete term
glossaryRouter.delete(
  '/terms/:id',
  validate([
    param('id').isUUID().withMessage('Valid term ID is required'),
  ]),
  asyncHandler(async (req, res) => {
    await glossaryService.deleteTerm(req.params['id']!);
    res.status(204).send();
  })
);

// GET /api/v1/glossary/terms/:id/assets - Get assets mapped to term
glossaryRouter.get(
  '/terms/:id/assets',
  validate([
    param('id').isUUID().withMessage('Valid term ID is required'),
  ]),
  asyncHandler(async (req, res) => {
    const assets = await glossaryService.getAssetsForTerm(req.params['id']!);
    res.json({ assets });
  })
);

// =====================
// Semantic Mapping Routes
// =====================

// POST /api/v1/glossary/mappings - Create mapping
glossaryRouter.post(
  '/mappings',
  validate([
    body('businessTermId').isUUID().withMessage('Valid business term ID is required'),
    body('assetId').notEmpty().withMessage('Valid asset ID is required'),
  ]),
  asyncHandler(async (req, res) => {
    const data = CreateSemanticMappingSchema.parse(req.body);
    const mapping = await glossaryService.createMapping(data, req.user!.id);
    res.status(201).json({ mapping });
  })
);

// GET /api/v1/glossary/mappings/term/:termId - Get mappings for term
glossaryRouter.get(
  '/mappings/term/:termId',
  validate([
    param('termId').isUUID().withMessage('Valid term ID is required'),
  ]),
  asyncHandler(async (req, res) => {
    const mappings = await glossaryService.getMappingsForTerm(req.params['termId']!);
    res.json({ mappings });
  })
);

// GET /api/v1/glossary/mappings/asset/:assetId - Get mappings for asset
glossaryRouter.get(
  '/mappings/asset/:assetId',
  validate([
    param('assetId').notEmpty().withMessage('Valid asset ID is required'),
  ]),
  asyncHandler(async (req, res) => {
    const result = await glossaryService.getMappingsForAsset(req.params['assetId']!);
    res.json(result);
  })
);

// DELETE /api/v1/glossary/mappings/:id - Delete mapping
glossaryRouter.delete(
  '/mappings/:id',
  validate([
    param('id').isUUID().withMessage('Valid mapping ID is required'),
  ]),
  asyncHandler(async (req, res) => {
    await glossaryService.deleteMapping(req.params['id']!);
    res.status(204).send();
  })
);
