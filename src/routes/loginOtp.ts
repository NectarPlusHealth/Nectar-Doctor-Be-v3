// src/routes/loginOtp.ts
import { Router } from 'express';
import loginOtpController from '../controllers/loginOtpController';

const router = Router();

router.post('/send', loginOtpController.sendLoginOtp);
router.post('/verify', loginOtpController.verifyLoginOtp);

export default router;
