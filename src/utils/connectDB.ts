import config from "../../config/custom-env-vars";
import mongoose from "mongoose";

// const localUri = config.get<string>("dbUri");
const localUri = config.dbUri as string;

async function connectDB() {
  try {
    await mongoose.connect(localUri);
    console.log("? Database connected successfully");
  } catch (error: any) {
    console.log(error.message);
    setTimeout(connectDB, 5000);
  }
}

export default connectDB;
