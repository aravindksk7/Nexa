import { Router, Request, Response } from 'express';
import { authRouter } from './auth.routes.js';
import { assetsRouter } from './assets.routes.js';
import { lineageRouter } from './lineage.routes.js';
import { columnLineageRouter } from './columnLineage.routes.js';
import { glossaryRouter } from './glossary.routes.js';
import { connectionsRouter } from './connections.routes.js';
import { filesRouter } from './files.routes.js';
import { searchRouter } from './search.routes.js';
import qualityRouter from './quality.routes.js';
import relationshipRouter from './relationship.routes.js';
import notificationRouter from './notification.routes.js';
import workflowRouter from './workflow.routes.js';
import ssoRouter from './sso.routes.js';
import dashboardRouter from './dashboard.routes.js';

export const apiRouter = Router();

// Mount route modules
apiRouter.use('/auth', authRouter);
apiRouter.use('/assets', assetsRouter);
apiRouter.use('/lineage', lineageRouter);
apiRouter.use('/lineage/columns', columnLineageRouter);
apiRouter.use('/glossary', glossaryRouter);
apiRouter.use('/connections', connectionsRouter);
apiRouter.use('/files', filesRouter);
apiRouter.use('/search', searchRouter);
apiRouter.use('/quality', qualityRouter);
apiRouter.use('/relationships', relationshipRouter);
apiRouter.use('/notifications', notificationRouter);
apiRouter.use('/workflows', workflowRouter);
apiRouter.use('/sso', ssoRouter);
apiRouter.use('/dashboard', dashboardRouter);

// API info endpoint
apiRouter.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Nexa API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/v1/auth',
      assets: '/api/v1/assets',
      lineage: '/api/v1/lineage',
      columnLineage: '/api/v1/lineage/columns',
      glossary: '/api/v1/glossary',
      connections: '/api/v1/connections',
      files: '/api/v1/files',
      search: '/api/v1/search',
      quality: '/api/v1/quality',
      relationships: '/api/v1/relationships',
      notifications: '/api/v1/notifications',
      workflows: '/api/v1/workflows',
      sso: '/api/v1/sso',
      dashboard: '/api/v1/dashboard',
    },
  });
});
