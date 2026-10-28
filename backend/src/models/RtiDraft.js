import mongoose from "mongoose";

const { Schema } = mongoose;

const authoritySchema = new Schema(
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
  },
  { _id: false },
);

const receivingOfficeSchema = new Schema(
  {
    name: { type: String, trim: true, maxlength: 200 },
    pioName: { type: String, trim: true, maxlength: 200 },
    sourceDescription: { type: String, trim: true, maxlength: 1000 },
    sourceUrl: { type: String, trim: true, maxlength: 2048 },
    verificationStatus: {
      type: String,
      enum: ["UNVERIFIED"],
      default: "UNVERIFIED",
      required: true,
    },
  },
  { _id: false },
);

const responseDeadlineSchema = new Schema(
  {
    dueAt: { type: Date },
    sourceType: {
      type: String,
      enum: ["USER_PROVIDED", "OFFICIAL_SOURCE", "AI_GENERATED"],
    },
    sourceDescription: { type: String, trim: true, maxlength: 1000 },
    sourceUrl: { type: String, trim: true, maxlength: 2048 },
    verificationStatus: {
      type: String,
      enum: ["UNVERIFIED"],
      default: "UNVERIFIED",
      required: true,
    },
  },
  { _id: false },
);

const rtiDraftSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    case: { type: Schema.Types.ObjectId, ref: "Case", default: null },
    kind: {
      type: String,
      enum: ["APPLICATION", "FIRST_APPEAL", "ACTION_TAKEN_REQUEST"],
      default: "APPLICATION",
      required: true,
    },
    automationKey: { type: String, unique: true, sparse: true, select: false },
    status: {
      type: String,
      enum: ["DRAFT"],
      default: "DRAFT",
      required: true,
    },
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 10000 },
    applicationText: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 30000,
    },
    authority: { type: authoritySchema, default: undefined },
    receivingOffice: { type: receivingOfficeSchema, default: undefined },
    submission: {
      userReportedDate: { type: Date },
      status: {
        type: String,
        enum: ["NOT_RECORDED", "USER_REPORTED_DATE"],
        default: "NOT_RECORDED",
        required: true,
      },
    },
    responseDeadline: { type: responseDeadlineSchema, default: undefined },
  },
  { timestamps: true },
);

rtiDraftSchema.index({ user: 1, updatedAt: -1 });
rtiDraftSchema.index({ user: 1, status: 1, createdAt: -1 });
rtiDraftSchema.index({ case: 1 });

export default mongoose.models.RtiDraft || mongoose.model("RtiDraft", rtiDraftSchema);
