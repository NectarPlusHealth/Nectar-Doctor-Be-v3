import { s3Client, bucket } from "../config/aws";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuid } from "uuid";

export const imageUpload = async (file: Express.Multer.File, folder = "uploads") => {
  const safeFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, "");
  const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `${safeFolder}/${uuid()}-${safeName}`;

  const uploadParams = {
    Bucket: bucket,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  try {
    await s3Client.send(new PutObjectCommand(uploadParams));
    const fileUrl = `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    return fileUrl;
  } catch (err) {
    console.error("S3 Upload Error:", err);
    throw new Error("Failed to upload file to S3");
  }
};
