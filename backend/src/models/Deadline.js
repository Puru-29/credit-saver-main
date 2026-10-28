import mongoose from "mongoose";

const { Schema } = mongoose;

const reminderSchema = new Schema(
  {
    scheduledAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["SCHEDULED", "SENT", "CANCELLED", "FAILED"],
      default: "SCHEDULED",
      required: true,
    },
    sentAt: { type: Date },
  },
  { _id: true },
);

const monitoringSchema = new Schema(
  {
    nextRecommendedStep: { type: String, trim: true, maxlength: 1000 },
    nextStepPreparedAt: { type: Date },
    nextStepKey: { type: String, select: false },
    lastCheckedAt: { type: Date },
  },
  { _id: false },
);

const deadlineSchema = new Schema(
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
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    dueAt: { type: Date, required: true, index: true },
    kind: {
      type: String,
      enum: ["STATUTORY", "CONFIGURED"],
      required: true,
    },
    dateBasis: {
      type: String,
      enum: ["USER_SUPPLIED", "RULE_DERIVED"],
      default: "USER_SUPPLIED",
      required: true,
    },
    status: {
      type: String,
      enum: ["UPCOMING", "DUE", "OVERDUE", "COMPLETED", "CANCELLED"],
      default: "UPCOMING",
      required: true,
      index: true,
    },
    sourceType: {
      type: String,
      enum: [
        "OFFICIAL_SOURCE",
        "CONFIGURED",
        "RULE_DERIVED",
        "AI_GENERATED",
        "USER_PROVIDED",
      ],
      required: true,
    },
    sourceDescription: { type: String, trim: true, maxlength: 1000 },
    sourceUrl: { type: String, trim: true, maxlength: 2048 },
    verificationStatus: {
      type: String,
      enum: ["UNVERIFIED", "VERIFIED"],
      default: "UNVERIFIED",
      required: true,
    },
    verifiedAt: { type: Date },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    verificationMethod: {
      type: String,
      enum: ["USER_ATTESTED"],
    },
    reminders: { type: [reminderSchema], default: [] },
    monitoring: { type: monitoringSchema, default: () => ({}) },
  },
  { timestamps: true },
);

deadlineSchema.pre("validate", function validateDeadlineSource() {
  if (
    (this.dateBasis === "RULE_DERIVED" &&
      (this.sourceType !== "RULE_DERIVED" || !this.sourceDescription)) ||
    (this.sourceType === "RULE_DERIVED" && this.dateBasis !== "RULE_DERIVED")
  ) {
    this.invalidate(
      "dateBasis",
      "Rule-derived dates require a recorded rule-derived source description",
    );
  }

  if (this.verificationStatus === "VERIFIED") {
    if (!this.sourceDescription) {
      this.invalidate("sourceDescription", "A source is required for a verified deadline");
    }
    if (!this.verifiedAt) {
      this.invalidate("verifiedAt", "A verification timestamp is required");
    }
    if (!this.verifiedBy) {
      this.invalidate("verifiedBy", "The verifying user must be recorded");
    }
    if (!["OFFICIAL_SOURCE", "CONFIGURED", "RULE_DERIVED"].includes(this.sourceType)) {
      this.invalidate(
        "sourceType",
        "AI-generated or user-provided dates cannot be marked verified without a recorded official, configured, or rule-derived source",
      );
    }
    if (this.verificationMethod !== "USER_ATTESTED") {
      this.invalidate("verificationMethod", "Verification must record the user's attestation");
    }
  }
});

deadlineSchema.index({ user: 1, case: 1, dueAt: 1 });
deadlineSchema.index({ user: 1, status: 1, dueAt: 1 });

export default mongoose.models.Deadline || mongoose.model("Deadline", deadlineSchema);
