import { Router, Request, Response, NextFunction } from 'express';
import { qualityService } from '../services/quality.service.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// All quality routes require authentication
router.use(authenticate);

// GET /api/v1/quality/overview - Get aggregate quality overview for dashboard
router.get(
  '/overview',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const overview = await qualityService.getOverview();
      res.json(overview);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/quality/rules - Create a quality rule
router.post(
  '/rules',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { assetId, name, description, ruleType, ruleDefinition, severity } = req.body;

      if (!assetId || !name || !ruleType || !ruleDefinition || !severity) {
        res.status(400).json({
          error: 'Missing required fields: assetId, name, ruleType, ruleDefinition, severity',
        });
        return;
      }

      const rule = await qualityService.createRule({
        assetId,
        name,
        description,
        ruleType,
        ruleDefinition,
        severity,
        createdById: req.user!.id,
      });

      res.status(201).json({ rule });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/quality/rules/:id - Get a quality rule
router.get(
  '/rules/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rule = await qualityService.getRule(req.params['id']!);

      if (!rule) {
        res.status(404).json({ error: 'Rule not found' });
        return;
      }

      res.json({ rule });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/v1/quality/rules/:id - Update a quality rule
router.put(
  '/rules/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, description, ruleType, ruleDefinition, severity, enabled } = req.body;

      const rule = await qualityService.updateRule(req.params['id']!, {
        name,
        description,
        ruleType,
        ruleDefinition,
        severity,
        enabled,
      });

      res.json({ rule });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/v1/quality/rules/:id - Delete a quality rule
router.delete(
  '/rules/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await qualityService.deleteRule(req.params['id']!);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/quality/rules/:id/evaluate - Evaluate a quality rule
router.post(
  '/rules/:id/evaluate',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await qualityService.evaluateRule(req.params['id']!);
      res.json({ result });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/quality/assets/:assetId/rules - List rules for an asset
router.get(
  '/assets/:assetId/rules',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rules = await qualityService.listRulesForAsset(req.params['assetId']!);
      res.json({ rules });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/quality/assets/:assetId/status - Get quality status for an asset
router.get(
  '/assets/:assetId/status',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = await qualityService.getAssetQualityStatus(req.params['assetId']!);
      res.json({ status });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/quality/assets/:assetId/evaluate - Evaluate all rules for an asset
router.post(
  '/assets/:assetId/evaluate',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const results = await qualityService.evaluateAllRulesForAsset(req.params['assetId']!);
      res.json({ results });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/quality/assets/:assetId/history - Get quality history for an asset
router.get(
  '/assets/:assetId/history',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = parseInt(req.query['limit'] as string) || 50;
      const history = await qualityService.getQualityHistory(req.params['assetId']!, limit);
      res.json({ history });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
