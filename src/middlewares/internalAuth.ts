// src/middlewares/internalAuth.ts
import { Request, Response, NextFunction } from 'express';
import { config } from '../config/environment';
import response from '../utils/response';

/**
 * Middleware that validates the x-internal-key header.
 * Used to protect internal endpoints that are only called by the Admin Backend.
 * The key must match INTERNAL_API_KEY environment variable.
 */
export function internalAuth(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers['x-internal-key'];

  if (!config.internalApiKey) {
    // If INTERNAL_API_KEY is not configured, reject all requests to be safe
    response.error({ message: 'Internal API not configured' }, res, 503);
    return;
  }

  if (!key || key !== config.internalApiKey) {
    response.error({ message: 'Unauthorized' }, res, 401);
    return;
  }

  next();
}
