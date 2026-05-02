import { Request, Response } from "express";
import httpStatus from "http-status";
import sharp from "sharp";
import { imageUpload } from "../utils/imageUpload";
import { deleteImage, removeFileFromDoctorDB } from "../utils/imageDelete";

export const uploadFile = async (req: Request, res: Response) => {
  try {
    if (!req.files || !("file" in req.files)) {
      return res.status(httpStatus.BAD_REQUEST).json({ message: "Missing file" });
    }

    const file = (req.files as { [fieldname: string]: Express.Multer.File[] }).file[0];

    // Resize image if large
    if (file.mimetype.startsWith("image/") && file.size > 1024 * 1024) {
      file.buffer = await sharp(file.buffer)
        .resize({ fit: "inside", width: 800, height: 800 })
        .toBuffer();
    }

    const uploadedUrl = await imageUpload(file, "user-uploads");

    return res.status(httpStatus.OK).json({
      message: "File uploaded successfully",
      data: { url: uploadedUrl },
    });
  } catch (err) {
    console.error(err);
    return res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: "Failed to upload file" });
  }
};


// export const deleteFile = async (req: Request, res: Response) => {
//   const {doctorId}=req.body;
//   console.log("deleteFile: ",doctorId);
//   try {
//     const { fileUrl } = req.body;

//     if (!fileUrl) {
//       return res.status(httpStatus.BAD_REQUEST).json({ message: "fileUrl is required" });
//     }

//     await deleteImage(fileUrl);

//     return res.status(httpStatus.OK).json({
//       message: "File deleted successfully",
//     });
//   } catch (err) {
//     console.error(err);
//     return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
//       message: "Failed to delete file",
//     });
//   }
// };
export const deleteFile = async (req: Request, res: Response) => {
  try {
    const { fileUrl, controlName, doctorId } = req.body;

    if (!fileUrl || !controlName || !doctorId) {
      return res.status(400).json({ message: "fileUrl, controlName & doctorId are required" });
    }

    // 1. Remove from S3
    await deleteImage(fileUrl);

    // 2. Remove from DB
    await removeFileFromDoctorDB(doctorId, controlName);

    return res.status(200).json({
      message: "File deleted from S3 and DB",
      success: true
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to delete file" });
  }
};