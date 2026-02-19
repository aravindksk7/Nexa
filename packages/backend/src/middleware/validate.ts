import { Request, Response, NextFunction, RequestHandler } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { ValidationError } from './errorHandler.js';

/**
 * Validation middleware that runs validation chains and handles errors
 */
export const validate = (validations: ValidationChain[]): RequestHandler[] => {
  return [
    ...validations,
    (req: Request, _res: Response, next: NextFunction): void => {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(err => ({
          field: 'path' in err ? err.path : 'unknown',
          message: err.msg,
        }));

        next(new ValidationError('Validation failed', errorMessages));
        return;
      }

      next();
    },
  ];
};

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
