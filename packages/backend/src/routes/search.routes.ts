import { Router } from 'express';
import { query } from 'express-validator';
import { searchService } from '../services/search.service.js';
import { authenticate, asyncHandler, validate } from '../middleware/index.js';
import type { AssetType } from '../models/index.js';

export const searchRouter = Router();

// All routes require authentication
searchRouter.use(authenticate);

// GET /api/v1/search - Full-text search
searchRouter.get(
  '/',
  validate([
    query('q').isString().trim().notEmpty().withMessage('Search query is required'),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('pageSize').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('assetTypes').optional().isString(),
    query('owners').optional().isString(),
    query('tags').optional().isString(),
    query('domains').optional().isString(),
    query('sortBy').optional().isIn(['relevance', 'name', 'createdAt', 'updatedAt']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
  ]),
  asyncHandler(async (req, res) => {
    const q = String(req.query['q'] || '');
    const page = Math.max(1, parseInt(String(req.query['page'] ?? 1), 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query['pageSize'] ?? 20), 10)));
    const assetTypesStr = req.query['assetTypes'];
    const ownersStr = req.query['owners'];
    const tagsStr = req.query['tags'];
    const domainsStr = req.query['domains'];
    const sortByStr = req.query['sortBy'] || 'relevance';
    const sortOrderStr = req.query['sortOrder'] || 'desc';

    const result = await searchService.search(q, {
      page,
      pageSize,
      assetTypes: typeof assetTypesStr === 'string' ? (assetTypesStr.split(',') as AssetType[]) : [],
      owners: typeof ownersStr === 'string' ? ownersStr.split(',') : [],
      tags: typeof tagsStr === 'string' ? tagsStr.split(',') : [],
      domains: typeof domainsStr === 'string' ? domainsStr.split(',') : [],
      sortBy: (typeof sortByStr === 'string' ? sortByStr : 'relevance') as 'relevance' | 'name' | 'createdAt' | 'updatedAt',
      sortOrder: (typeof sortOrderStr === 'string' ? sortOrderStr : 'desc') as 'asc' | 'desc',
    });

    res.json(result);
  })
);

// GET /api/v1/search/facets - Get faceted search results
searchRouter.get(
  '/facets',
  validate([
    query('q').optional().isString().trim(),
  ]),
  asyncHandler(async (req, res) => {
    const q = req.query['q'] ? String(req.query['q']) : undefined;

    const facets = await searchService.getFacets(q);

    res.json({ facets });
  })
);

// GET /api/v1/search/suggest - Get search suggestions
searchRouter.get(
  '/suggest',
  validate([
    query('q').isString().trim().notEmpty().withMessage('Prefix is required'),
    query('limit').optional().isInt({ min: 1, max: 20 }).toInt(),
  ]),
  asyncHandler(async (req, res) => {
    const q = String(req.query['q'] || '');

    const suggestions = await searchService.suggest(q);

    res.json({ suggestions });
  })
);
