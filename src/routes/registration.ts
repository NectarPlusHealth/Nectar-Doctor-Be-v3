// src/routes/registration.ts
import { Router } from 'express';
import registrationController from '../controllers/registrationController';
import { validate } from '../middlewares/validate'; 
import * as schema from '../schemas/registrationSchema';
import authController from '../controllers/authController';
import { verifyAuthToken } from '../utils/auth';

const router = Router();

router.post('/register', validate(schema.signUp), registrationController.createRegistration);
router.post('/login', validate(schema.login), authController.login);
router.post('/verify-otp', validate(schema.verifyOTP), registrationController.verifyOtp);
router.post('/resend-otp', validate(schema.sendOTP), registrationController.resendOtp);
router.post('/logout', authController.logout);

// FCM device token registration/refresh — called after login or when token refreshes
router.patch('/device-token', verifyAuthToken, authController.updateDeviceToken);

export default router;
