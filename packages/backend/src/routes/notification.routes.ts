import { Router, Request, Response, NextFunction } from 'express';
import { notificationService } from '../services/notification.service.js';
import { authenticate } from '../middleware/auth.js';
import { VALID_TYPES } from '../services/notification.service.js';

const router = Router();

router.use(authenticate);

// GET /api/v1/notifications - List notifications for the authenticated user
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const unreadOnly = req.query['unreadOnly'] === 'true';
      const limit = parseInt(req.query['limit'] as string) || 50;
      const offset = parseInt(req.query['offset'] as string) || 0;
      const result = await notificationService.listNotifications(req.user!.id, { unreadOnly, limit, offset });
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/v1/notifications/unread-count - Get unread count
router.get(
  '/unread-count',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const count = await notificationService.getUnreadCount(req.user!.id);
      res.json({ count });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/v1/notifications - Create a notification (admin/system use)
router.post(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId, type, title, message, metadata } = req.body;
      if (!userId || !type || !title || !message) {
        res.status(400).json({ error: 'Missing required fields: userId, type, title, message' });
        return;
      }
      if (!VALID_TYPES.includes(type)) {
        res.status(400).json({ error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` });
        return;
      }
      const notification = await notificationService.createNotification({ userId, type, title, message, metadata });
      res.status(201).json({ notification });
    } catch (error) {
      next(error);
    }
  },
);

// PATCH /api/v1/notifications/:id/read - Mark a single notification as read
router.patch(
  '/:id/read',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const notification = await notificationService.markAsRead(req.params['id']!, req.user!.id);
      res.json({ notification });
    } catch (error) {
      next(error);
    }
  },
);

// PATCH /api/v1/notifications/read-all - Mark all notifications as read
router.patch(
  '/read-all',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await notificationService.markAllAsRead(req.user!.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

// DELETE /api/v1/notifications/:id - Delete a notification
router.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await notificationService.deleteNotification(req.params['id']!, req.user!.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

export default router;
