import mongoose from "mongoose";
import { setServers } from "node:dns";

export async function connectDatabase(uri, dnsServers = []) {
  if (!uri?.trim()) {
    throw new Error("MONGODB_URI is required to connect to MongoDB.");
  }

  if (dnsServers.length > 0) {
    setServers(dnsServers);
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
