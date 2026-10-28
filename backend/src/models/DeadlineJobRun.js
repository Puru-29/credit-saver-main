import mongoose from "mongoose";

const { Schema } = mongoose;

const errorSchema = new Schema(
  {
    stage: { type: String, required: true, maxlength: 100 },
    code: { type: String, required: true, maxlength: 80 },
  },
  { _id: false },
);

const deadlineJobRunSchema = new Schema(
  {
    job: {
      type: String,
      enum: ["DEADLINE_MONITORING"],
      required: true,
      default: "DEADLINE_MONITORING",
    },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, required: true },
    status: { type: String, enum: ["SUCCEEDED", "PARTIAL", "FAILED"], required: true },
    counts: {
      usersScanned: { type: Number, min: 0, default: 0 },
      deadlinesScanned: { type: Number, min: 0, default: 0 },
      upcomingDeadlines: { type: Number, min: 0, default: 0 },
      overdueDeadlines: { type: Number, min: 0, default: 0 },
      reminderEventsRecorded: { type: Number, min: 0, default: 0 },
      nextStepsPrepared: { type: Number, min: 0, default: 0 },
      firstAppealDraftsPrepared: { type: Number, min: 0, default: 0 },
      actionTakenDraftsPrepared: { type: Number, min: 0, default: 0 },
      actionTakenCasesPrepared: { type: Number, min: 0, default: 0 },
    },
    errorRecords: { type: [errorSchema], default: [] },
  },
  { timestamps: true },
);

deadlineJobRunSchema.index({ job: 1, startedAt: -1 });

export default mongoose.models.DeadlineJobRun ||
  mongoose.model("DeadlineJobRun", deadlineJobRunSchema);
