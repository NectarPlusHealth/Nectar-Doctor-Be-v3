// src/routes/registration.ts
import { Router } from 'express';
import registrationController from '../controllers/registrationController';
import { validate } from '../middlewares/validate'; 
import * as schema from '../schemas/registrationSchema';
import authController from '../controllers/authController';
// import doctorRoutes from "./doctor"; // note: file name is Doctor.ts (case-sensitive on some OS)

const router = Router();

router.post('/register', validate(schema.signUp), registrationController.createRegistration);
router.post('/login', validate(schema.login), authController.login);
router.post('/verify-otp', validate(schema.verifyOTP), registrationController.verifyOtp);
router.post('/resend-otp', validate(schema.sendOTP), registrationController.resendOtp);
router.post('/logout', authController.logout);
// router.use("/doctor", doctorRoutes);
export default router;
