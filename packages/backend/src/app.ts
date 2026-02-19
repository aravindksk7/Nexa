import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiRouter } from './routes/index.js';

export const createApp = (): Express => {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(
    cors({
      origin: config.server.isDevelopment 
        ? ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'] 
        : process.env['ALLOWED_ORIGINS']?.split(','),
      credentials: true,
    })
  );

  // Rate limiting (disabled in test/development mode)
  if (!config.server.isTest && !config.server.isDevelopment) {
    const limiter = rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.maxRequests,
      message: { error: 'Too many requests, please try again later' },
      standardHeaders: true,
      legacyHeaders: false,
    });
    app.use('/api', limiter);
  }

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logging
  if (!config.server.isTest) {
    app.use(
      morgan('combined', {
        stream: {
          write: (message: string) => {
            logger.info(message.trim());
          },
        },
      })
    );
  }

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API routes
  app.use('/api/v1', apiRouter);

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Global error handler
  app.use(errorHandler);

  return app;
};

export const startServer = (app: Express): void => {
  const { port, host } = config.server;

  app.listen(port, host, () => {
    logger.info(`🚀 Server running at http://${host}:${port}`);
    logger.info(`📚 API available at http://${host}:${port}/api/v1`);
    logger.info(`💚 Health check at http://${host}:${port}/health`);
  });
};
