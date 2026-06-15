import { Router } from 'express';
import { verifyAuthToken } from '../utils/auth';
import { uploadFiles } from '../middlewares/multer';
import { getKycMe, submitKyc, uploadCheque } from '../controllers/kycController';

const router = Router();

const asyncHandler =
  (fn: any) =>
  (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

router.get('/me', verifyAuthToken, asyncHandler(getKycMe));
router.post('/submit', verifyAuthToken, asyncHandler(submitKyc));
router.post(
  '/upload-cheque',
  verifyAuthToken,
  uploadFiles([{ name: 'file', count: 1 }]),
  asyncHandler(uploadCheque)
);

export default router;
