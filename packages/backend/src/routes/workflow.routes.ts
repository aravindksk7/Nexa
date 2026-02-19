import { Router, Request, Response, NextFunction } from 'express';
import { workflowService } from '../services/workflow.service.js';
import { authenticate } from '../middleware/auth.js';

type WorkflowStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

const router = Router();

router.use(authenticate);

// GET /api/v1/workflows - List workflows
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = parseInt(req.query['limit'] as string) || 50;
      const offset = parseInt(req.query['offset'] as string) || 0;
      const result = await workflowService.listWorkflows({ limit, offset });
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/v1/workflows - Create a workflow
router.post(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name, description, definition } = req.body;
      if (!name || !definition) {
        res.status(400).json({ error: 'Missing required fields: name, definition' });
        return;
      }
      const workflow = await workflowService.createWorkflow({ name, description, definition });
      res.status(201).json({ workflow });
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/v1/workflows/:id - Get a workflow
router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const workflow = await workflowService.getWorkflow(req.params['id']!);
      if (!workflow) {
        res.status(404).json({ error: 'Workflow not found' });
        return;
      }
      res.json({ workflow });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/v1/workflows/:id/trigger - Trigger a workflow instance
router.post(
  '/:id/trigger',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { context = {} } = req.body;
      const instance = await workflowService.triggerWorkflow({
        workflowId: req.params['id']!,
        context: { ...context, triggeredById: req.user!.id },
      });
      res.status(201).json({ instance });
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/v1/workflows/instances - List all workflow instances
router.get(
  '/instances/list',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = parseInt(req.query['limit'] as string) || 50;
      const offset = parseInt(req.query['offset'] as string) || 0;
      const status = req.query['status'] as string | undefined;
      const result = await workflowService.listWorkflowInstances({
        ...(status ? { status: status as WorkflowStatus } : {}),
        limit,
        offset,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/v1/workflows/instances/:instanceId - Get a workflow instance
router.get(
  '/instances/:instanceId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const instance = await workflowService.getWorkflowInstance(req.params['instanceId']!);
      if (!instance) {
        res.status(404).json({ error: 'Workflow instance not found' });
        return;
      }
      res.json({ instance });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/v1/workflows/instances/:instanceId/steps/:stepId/approve - Approve a step
router.post(
  '/instances/:instanceId/steps/:stepId/approve',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { comment } = req.body;
      const instance = await workflowService.approveStep(
        req.params['instanceId']!,
        req.params['stepId']!,
        req.user!.id,
        comment,
      );
      res.json({ instance });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/v1/workflows/instances/:instanceId/steps/:stepId/reject - Reject a step
router.post(
  '/instances/:instanceId/steps/:stepId/reject',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { comment } = req.body;
      const instance = await workflowService.rejectStep(
        req.params['instanceId']!,
        req.params['stepId']!,
        req.user!.id,
        comment,
      );
      res.json({ instance });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/v1/workflows/instances/:instanceId/cancel - Cancel a workflow instance
router.post(
  '/instances/:instanceId/cancel',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const instance = await workflowService.cancelWorkflowInstance(req.params['instanceId']!);
      res.json({ instance });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
