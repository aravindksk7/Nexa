import { Router, Request, Response } from 'express';
import { authRouter } from './auth.routes.js';
import { assetsRouter } from './assets.routes.js';
import { lineageRouter } from './lineage.routes.js';
import { connectionsRouter } from './connections.routes.js';
import { filesRouter } from './files.routes.js';
import { searchRouter } from './search.routes.js';

export const apiRouter = Router();

// Mount route modules
apiRouter.use('/auth', authRouter);
apiRouter.use('/assets', assetsRouter);
apiRouter.use('/lineage', lineageRouter);
apiRouter.use('/connections', connectionsRouter);
apiRouter.use('/files', filesRouter);
apiRouter.use('/search', searchRouter);

// API info endpoint
apiRouter.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Nexa API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/v1/auth',
      assets: '/api/v1/assets',
      lineage: '/api/v1/lineage',
      connections: '/api/v1/connections',
      files: '/api/v1/files',
      search: '/api/v1/search',
    },
  });
});
