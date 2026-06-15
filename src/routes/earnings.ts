import { Router } from 'express';
import { verifyAuthToken } from '../utils/auth';
import { getEarningsSummary, getEarningsPayments } from '../controllers/earningsController';

const router = Router();

const asyncHandler =
  (fn: any) =>
  (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

router.get('/summary', verifyAuthToken, asyncHandler(getEarningsSummary));
router.get('/payments', verifyAuthToken, asyncHandler(getEarningsPayments));

export default router;
