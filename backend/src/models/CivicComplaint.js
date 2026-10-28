import mongoose from "mongoose";

const { Schema } = mongoose;

const imageMetadataSchema = new Schema(
  {
    filename: { type: String, trim: true, maxlength: 255 },
    mimeType: {
      type: String,
      enum: ["image/jpeg", "image/png", "image/webp", "image/gif"],
      required: true,
    },
    sizeBytes: { type: Number, min: 1, max: 10 * 1024 * 1024, required: true },
    storageProvider: {
      type: String,
      enum: ["LOCAL", "S3", "GCS", "AZURE", "OTHER"],
    },
    storageKey: { type: String, trim: true, maxlength: 1024 },
  },
  { _id: true },
);

const authorityAssignmentSchema = new Schema(
  {
    name: { type: String, trim: true, maxlength: 200 },
    sourceDescription: { type: String, trim: true, maxlength: 1000 },
    sourceUrl: { type: String, trim: true, maxlength: 2048 },
    verificationStatus: {
      type: String,
      enum: ["UNVERIFIED"],
      default: "UNVERIFIED",
      required: true,
    },
    recordedAt: { type: Date },
  },
  { _id: false },
);

const civicComplaintSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    case: {
      type: Schema.Types.ObjectId,
      ref: "Case",
      required: true,
      unique: true,
    },
    category: {
      type: String,
      enum: ["POTHOLES", "GARBAGE", "STREETLIGHTS", "DRAINAGE", "WATER_SUPPLY"],
      required: true,
      index: true,
    },
    images: { type: [imageMetadataSchema], default: [] },
    authorityAssignment: { type: authorityAssignmentSchema, default: undefined },
  },
  { timestamps: true },
);

civicComplaintSchema.index({ user: 1, category:  1, updatedAt: -1 });

export default mongoose.models.CivicComplaint ||
  mongoose.model("CivicComplaint", civicComplaintSchema);
