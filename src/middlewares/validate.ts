// src/middlewares/validate.ts
import { Request, Response, NextFunction, RequestHandler } from 'express';
import httpStatus from 'http-status';
import response from '../utils/response';
import { Schema } from 'joi';

export const validate = (schema: Schema, source: 'body' | 'params' | 'query' = 'body'): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // use a typed alias so we can assign back
    const reqAny = req as any;
    const data = reqAny[source];

    try {
      const { value, error } = await schema.validate(data, {
        abortEarly: false,
        allowUnknown: true,
        stripUnknown: true,
      });

      if (!error) {
        reqAny[source] = value;
        next();
        return;
      } else {
        const message = error.details.map((i: any) => i.message).join(',');
        // CALL response.error and then return void
        response.error(
          { msgCode: 'VALIDATION_ERROR', data: { message, joiError: true } },
          res,
          httpStatus.BAD_REQUEST
        );
        return;
      }
    } catch (err) {
      response.error({ msgCode: 'VALIDATION_ERROR' }, res, httpStatus.BAD_REQUEST);
      return;
    }
  };
};

export default validate;
