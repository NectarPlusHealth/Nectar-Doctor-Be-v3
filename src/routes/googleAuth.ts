// src/routes/googleAuth.ts
import { Router } from 'express';
import googleAuthController from '../controllers/googleAuthController';

const router = Router();

// POST /api/v1/auth/google
router.post('/google', googleAuthController.googleLogin);

export default router;
