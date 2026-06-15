import { Router } from 'express';
import { verifyAuthToken } from '../utils/auth';
import { getPayoutsWallet, getPayoutsList, getPayoutDetail } from '../controllers/payoutsController';

const router = Router();

const asyncHandler =
  (fn: any) =>
  (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

router.get('/wallet', verifyAuthToken, asyncHandler(getPayoutsWallet));
router.get('/list', verifyAuthToken, asyncHandler(getPayoutsList));
router.get('/:id', verifyAuthToken, asyncHandler(getPayoutDetail));

export default router;
