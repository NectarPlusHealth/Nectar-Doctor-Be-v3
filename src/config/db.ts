import mongoose from "mongoose";
import { config } from "./environment";
const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(config.mongoUri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1); // Exit process with failure
  }
};

export default connectDB;
