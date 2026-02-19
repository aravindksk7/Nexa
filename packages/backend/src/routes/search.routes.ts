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
    const {
      q,
      page = 1,
      pageSize = 20,
      assetTypes,
      owners,
      tags,
      domains,
      sortBy = 'relevance',
      sortOrder = 'desc',
    } = req.query as {
      q: string;
      page?: number;
      pageSize?: number;
      assetTypes?: string;
      owners?: string;
      tags?: string;
      domains?: string;
      sortBy?: 'relevance' | 'name' | 'createdAt' | 'updatedAt';
      sortOrder?: 'asc' | 'desc';
    };

    const result = await searchService.search(q, {
      page: Number(page),
      pageSize: Number(pageSize),
      assetTypes: assetTypes ? (assetTypes.split(',') as AssetType[]) : undefined,
      owners: owners ? owners.split(',') : undefined,
      tags: tags ? tags.split(',') : undefined,
      domains: domains ? domains.split(',') : undefined,
      sortBy,
      sortOrder,
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
    const { q } = req.query as { q?: string };

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
    const { q, limit = 10 } = req.query as { q: string; limit?: number };

    const suggestions = await searchService.suggest(q, Number(limit));

    res.json({ suggestions });
  })
);

// POST /api/v1/search/reindex - Reindex all assets (admin only)
searchRouter.post(
  '/reindex',
  asyncHandler(async (req, res) => {
    // In production, add admin role check
    await searchService.reindexAll();

    res.json({ message: 'Reindex completed successfully' });
  })
);
