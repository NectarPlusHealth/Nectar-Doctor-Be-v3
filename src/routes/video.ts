// src/routes/video.ts
import { Router } from "express";
import { verifyAuthToken } from "../utils/auth";

// import { getPatientData } from "../controllers/patientcontroller"; 
import * as videoController from "../controllers/videoController";

const router = Router();

router.get(
  "/list",
  verifyAuthToken,           
//   validate(schema.getDoctorList, "query"),
  videoController.allVideo
);
router.post("/", verifyAuthToken, videoController.addVideo);
router.put(
  "/",
  verifyAuthToken,
  // validate(schema.findVideo, "query"),
  // validate(schema.updateVideo),
  videoController.updateVideo
);

router.delete(
  "/",
  verifyAuthToken,
  // validate(schema.findVideo, "query"),
  videoController.deleteVideo
);


export default router;
