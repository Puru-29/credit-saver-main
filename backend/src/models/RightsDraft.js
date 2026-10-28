import mongoose from "mongoose";

const { Schema } = mongoose;

const rightsDraftSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    case: { type: Schema.Types.ObjectId, ref: "Case", default: null },
    category: {
      type: String,
      enum: ["TENANT", "GIG_WORKER_WORKPLACE"],
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: ["GUIDANCE", "FORMAL_LETTER"],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    inputFacts: {
      description: { type: String, trim: true, maxlength: 10000 },
      facts: [{ type: String, trim: true, maxlength: 2000 }],
      requestedAction: { type: String, trim: true, maxlength: 2000 },
      urgent: { type: Boolean, default: false },
    },
    content: { type: String, required: true, trim: true, maxlength: 30000 },
    verificationNotice: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);

rightsDraftSchema.index({ user: 1, updatedAt: -1 });
rightsDraftSchema.index({ user: 1, category: 1, kind: 1 });
rightsDraftSchema.index({ case: 1 });

export default mongoose.models.RightsDraft || mongoose.model("RightsDraft", rightsDraftSchema);
