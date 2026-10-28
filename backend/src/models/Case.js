import mongoose from "mongoose";

const { Schema } = mongoose;

const timelineEventSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["CREATED", "STATUS_CHANGED", "NOTE", "DOCUMENT", "DEADLINE", "ESCALATION"],
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    occurredAt: { type: Date, required: true, default: Date.now },
    monitoringKey: { type: String, select: false },
  },
  { _id: true },
);

const authoritySchema = new Schema(
  {
    name: { type: String, trim: true, maxlength: 200 },
    department: { type: String, trim: true, maxlength: 200 },
    jurisdiction: { type: String, trim: true, maxlength: 200 },
    contactEmail: { type: String, trim: true, lowercase: true, maxlength: 254 },
    source: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false },
);

const locationSchema = new Schema(
  {
    address: { type: String, trim: true, maxlength: 500 },
    locality: { type: String, trim: true, maxlength: 200 },
    city: { type: String, trim: true, maxlength: 200 },
    district: { type: String, trim: true, maxlength: 200 },
    state: { type: String, trim: true, maxlength: 200 },
    postalCode: { type: String, trim: true, maxlength: 20 },
    coordinates: {
      latitude: { type: Number, min: -90, max: 90 },
      longitude: { type: Number, min: -180, max: 180 },
    },
  },
  { _id: false },
);

const caseSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["RTI", "RIGHTS", "CIVIC"],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 200 },
    systemKey: { type: String, unique: true, sparse: true, select: false },
    summary: { type: String, trim: true, maxlength: 5000 },
    details: { type: String, trim: true, maxlength: 20000 },
    status: {
      type: String,
      enum: [
        "DRAFT",
        "OPEN",
        "IN_PROGRESS",
        "WAITING_FOR_RESPONSE",
        "RESOLVED",
        "CLOSED",
      ],
      required: true,
      default: "DRAFT",
      index: true,
    },
    location: { type: locationSchema, default: undefined },
    authority: { type: authoritySchema, default: undefined },
    timeline: { type: [timelineEventSchema], default: [] },
    escalation: {
      status: {
        type: String,
        enum: ["NONE", "DRAFT", "AWAITING_REVIEW", "APPROVED", "SUBMITTED", "CLOSED"],
        default: "NONE",
      },
      level: { type: String, trim: true, maxlength: 100 },
      lastActionAt: { type: Date },
    },
    parentCase: { type: Schema.Types.ObjectId, ref: "Case", default: null },
    relatedCases: [{ type: Schema.Types.ObjectId, ref: "Case" }],
  },
  { timestamps: true },
);

caseSchema.index({ user: 1, type: 1, status: 1 });
caseSchema.index({ user: 1, updatedAt: -1 });

export default mongoose.models.Case || mongoose.model("Case", caseSchema);
