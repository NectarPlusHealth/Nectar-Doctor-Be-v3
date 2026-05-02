import express from "express";
import { verifyAuthToken } from "../utils/auth"; 
import * as faqController from "../controllers/faqController";

const router = express.Router();

router.get(
  "/list",
  verifyAuthToken,
  faqController.allFAQ
);
router.post(
  "/",
  verifyAuthToken,
  faqController.addFAQ
);

router.put("/:id", verifyAuthToken, faqController.updateFAQ);

router.delete("/:id",verifyAuthToken, faqController.deleteFAQ);


export default router;
