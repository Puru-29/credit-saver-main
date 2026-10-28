import mongoose from "mongoose";

export async function connectDatabase(uri) {
  if (!uri?.trim()) {
    throw new Error("MONGODB_URI is required to connect to MongoDB.");
  }

  await mongoose.connect(uri);
  console.log("Connected to MongoDB");
  return mongoose.connection;
}

export async function closeDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log("MongoDB connection closed");
  }
}
