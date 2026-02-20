import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { qualityService } from '../services/quality.service.js';

const router = Router();

// All dashboard routes require authentication
router.use(authenticate);

// GET /api/v1/dashboard/overview - Aggregate dashboard stats
router.get(
  '/overview',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const recentUploadsDays = 7;
      const since = new Date();
      since.setDate(since.getDate() - recentUploadsDays);

      const [totalAssets, totalConnections, recentUploads, qualityOverview] = await Promise.all([
        prisma.asset.count(),
        prisma.lineageEdge.count(),
        prisma.fileUpload.count({ where: { createdAt: { gte: since } } }),
        qualityService.getOverview(),
      ]);

      res.json({
        totalAssets,
        totalConnections,
        recentUploads,
        recentUploadsDays,
        qualityScore: qualityOverview.overallScore ?? 0,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
