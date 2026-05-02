import multer from "multer";
import { Request, Response, NextFunction } from "express";
import httpStatus from "http-status";

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    "image/png",
    "image/jpg",
    "image/jpeg",
    "application/pdf",
    "image/webp",
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type"));
  }
};

const upload = multer({
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 },
});

export const uploadFiles = (fields: { name: string; count: number }[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const uploader = upload.fields(fields);
    uploader(req, res, (err: any) => {
      if (err) {
        return res.status(httpStatus.BAD_REQUEST).json({
          message: err.message || "File upload error",
        });
      }
      next();
    });
  };
};
