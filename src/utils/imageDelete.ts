// // utils/imageDelete.ts
import { s3Client, bucket } from "../config/aws";
import Doctor from "../models/Doctor";
// import { DeleteObjectCommand } from "@aws-sdk/client-s3";

// export const deleteImage = async (fileUrl: string) => {
//   try {
//     // Extract key from full S3 URL
//     const url = new URL(fileUrl);
//     const key = url.pathname.substring(1); // remove leading "/"

//     const command = new DeleteObjectCommand({
//       Bucket: bucket,
//       Key: key,
//     });

//     await s3Client.send(command);
//     return true;
//   } catch (err) {
//     console.error("S3 Delete Error:", err);
//     throw new Error("Failed to delete file from S3");
//   }
// };


import {
  DeleteObjectCommand,
  ListObjectVersionsCommand
} from "@aws-sdk/client-s3";

export const deleteImage = async (fileUrl: string) => {
  const url = new URL(fileUrl);
  const key = url.pathname.substring(1);

  // Step 1: List versions
  const versions = await s3Client.send(
    new ListObjectVersionsCommand({
      Bucket: bucket,
      Prefix: key,
    })
  );

  // Step 2: Delete all versions + delete markers
  const allVersions = [
    ...(versions.Versions || []),
    ...(versions.DeleteMarkers || [])
  ];

  for (const v of allVersions) {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
        VersionId: v.VersionId,
      })
    );
  }

  return true;
};


export  const removeFileFromDoctorDB = async (doctorId:any, controlName:any) => {
  let update = {};

  if (controlName === "identityProof") {
    update = { identityProof: [] };
  }
  if (controlName === "medicalProof") {
    update = { medicalProof: [] };
  }
  // if (controlName === "establishmentProof") {
  //   update = { establishmentProof: [] };
  // }

  // return await Doctor.findByIdAndUpdate(
  //   {userId:doctorId},
  //   { $set: update },
  //   { new: true }
  // );
    return await Doctor.findOneAndUpdate(
    { userId: doctorId },
    { $set: update },
    { new: true }
  );

};

