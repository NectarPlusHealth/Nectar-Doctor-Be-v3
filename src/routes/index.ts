// src/routes/index.ts
import doctorRoutes from "./doctor"; // note: file name is Doctor.ts (case-sensitive on some OS)
import faqRoutes from "./faqRoutes"; // note: file name is Doctor.ts (case-sensitive on some OS)
import registrationRoutes from "./registration";
import usersRoutes from "./users";
import { Router, Request, Response } from 'express';
import videoRoute from "./video"
import prescriptionRoutes from "./prescription";
import settingRoutes from "./setting";
import servicesRoutes from "./services";
import masterRoutes from "./master";

// import other routers...

const router = Router();

// mount doctor routes at /doctor
router.use("/doctor", doctorRoutes);
router.use("/video", videoRoute);
router.use("/prescription", prescriptionRoutes);
// router.use("/doctor/record", doctorRoutes);

// mount other routers
router.use("/registration", registrationRoutes);
router.use("/faq", faqRoutes);
router.use("/users", usersRoutes);
router.use("/setting", settingRoutes);
router.use("/services", servicesRoutes);
router.use("/master", masterRoutes);
router.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
        message: 'I am working',
        timestamp: new Date().toISOString()
    });
});

export default router;
