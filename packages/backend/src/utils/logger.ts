import pino, { LoggerOptions } from 'pino';
import { config } from '../config/index.js';

const pinoOptions: LoggerOptions = {
  level: config.logging.level,
  base: {
    env: config.server.nodeEnv,
  },
  formatters: {
    level: (label: string) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

// Add transport only if pretty logging is enabled
if (config.logging.format === 'pretty') {
  pinoOptions.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  };
}

export const logger = pino(pinoOptions);

export const createChildLogger = (context: string): pino.Logger => {
  return logger.child({ context });
};

export type Logger = pino.Logger;
