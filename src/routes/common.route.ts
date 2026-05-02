import express from "express";
import { uploadFiles } from "../middlewares/multer";
import { deleteFile, uploadFile } from "../controllers/common.controller";

const router = express.Router();
const asyncHandler =
  (fn: any) =>
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

router.post(
  "/upload",
  uploadFiles([{ name: "file", count: 1 }]),
  asyncHandler(uploadFile)
);
router.post(
  "/delete",
  // uploadFiles([{ name: "file", count: 1 }]),
  asyncHandler(deleteFile)
);

// router.post("/delete", deleteFile);
export default router;
