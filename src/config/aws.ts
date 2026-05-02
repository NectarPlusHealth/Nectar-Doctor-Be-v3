import { S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
dotenv.config();

const { AWS_REGION, ACCESS_KEY_ID, SECRET_ACCESS_KEY, S3_BUCKET } = process.env;

export const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: ACCESS_KEY_ID!,
    secretAccessKey: SECRET_ACCESS_KEY!,
  },
});

export const bucket = S3_BUCKET!;
