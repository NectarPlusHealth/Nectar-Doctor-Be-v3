// src/utils/response.ts
import { Response } from 'express';

const success = (payload: any, res: Response, status = 200) =>
  res.status(status).json({ success: true, ...payload });

const error = (payload: any, res: Response, status = 400) =>
  res.status(status).json({ success: false, ...payload });

export default { success, error };
