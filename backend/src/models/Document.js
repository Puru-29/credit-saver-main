import mongoose from "mongoose";

const { Schema } = mongoose;

const documentSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    case: { type: Schema.Types.ObjectId, ref: "Case", default: null, index: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
    type: {
      type: String,
      enum: [
        "RTI_APPLICATION",
        "FIRST_APPEAL",
        "RIGHTS_LETTER",
        "CIVIC_COMPLAINT",
        "GRIEVANCE",
        "REPRESENTATION",
        "EVIDENCE",
        "OTHER",
      ],
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ["GENERATED", "USER_PROVIDED"],
      required: true,
    },
    content: { type: String, trim: true, maxlength: 50000 },
    verificationStatus: {
      type: String,
      enum: ["UNVERIFIED", "USER_REVIEWED"],
      default: "UNVERIFIED",
      required: true,
    },
    reviewRequired: { type: Boolean, default: true, required: true },
    status: {
      type: String,
      enum: ["DRAFT", "FINAL", "ARCHIVED"],
      default: "DRAFT",
      required: true,
    },
    version: { type: Number, min: 1, default: 1 },
    mimeType: { type: String, trim: true, maxlength: 150 },
    originalFilename: { type: String, trim: true, maxlength: 255 },
    sizeBytes: { type: Number, min: 0 },
    storageProvider: {
      type: String,
      enum: ["LOCAL", "S3", "GCS", "AZURE", "OTHER"],
    },
    storageKey: { type: String, trim: true, maxlength: 1024 },
    sourceLabel: { type: String, trim: true, maxlength: 500 },
    sourceUrl: { type: String, trim: true, maxlength: 2048 },
  },
  { timestamps: true },
);

documentSchema.index({ user: 1, case: 1, type: 1 });
documentSchema.index({ user: 1, updatedAt: -1 });

export default mongoose.models.Document || mongoose.model("Document", documentSchema);
