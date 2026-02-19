import { Router, Request, Response, NextFunction } from 'express';
import { relationshipService } from '../services/relationship.service.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// All relationship routes require authentication
router.use(authenticate);

// POST /api/v1/relationships - Create a relationship
router.post(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sourceAssetId, targetAssetId, relationshipType, metadata } = req.body;

      if (!sourceAssetId || !targetAssetId || !relationshipType) {
        res.status(400).json({
          error: 'Missing required fields: sourceAssetId, targetAssetId, relationshipType',
        });
        return;
      }

      const relationship = await relationshipService.createRelationship({
        sourceAssetId,
        targetAssetId,
        relationshipType,
        metadata,
      });

      res.status(201).json({ relationship });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('already exists') || error.message.includes('circular')) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }
);

// GET /api/v1/relationships/:id - Get a relationship
router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const relationship = await relationshipService.getRelationship(req.params['id']!);

      if (!relationship) {
        res.status(404).json({ error: 'Relationship not found' });
        return;
      }

      res.json({ relationship });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/v1/relationships/:id - Delete a relationship
router.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await relationshipService.deleteRelationship(req.params['id']!);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/relationships/asset/:assetId - Get relationships for an asset
router.get(
  '/asset/:assetId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const direction = (req.query['direction'] as 'source' | 'target' | 'both') || 'both';
      const relationships = await relationshipService.getRelationshipsForAsset(
        req.params['assetId']!,
        direction
      );
      res.json({ relationships });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/relationships/asset/:assetId/summary - Get relationship summary for an asset
router.get(
  '/asset/:assetId/summary',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const summary = await relationshipService.getRelationshipSummary(req.params['assetId']!);
      res.json({ summary });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/relationships/asset/:assetId/derived - Get assets derived from this asset
router.get(
  '/asset/:assetId/derived',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const relationships = await relationshipService.getDerivedAssets(req.params['assetId']!);
      res.json({ relationships });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/relationships/asset/:assetId/sources - Get source assets for this asset
router.get(
  '/asset/:assetId/sources',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const relationships = await relationshipService.getSourceAssets(req.params['assetId']!);
      res.json({ relationships });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
