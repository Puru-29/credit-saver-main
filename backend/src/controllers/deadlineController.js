import mongoose from "mongoose";
import { z } from "zod";
import Case from "../models/Case.js";
import Deadline from "../models/Deadline.js";
import {
  calculateDeadlineDays,
  enrichDeadline,
  recordDeadlineEvent,
  refreshDeadlineStatuses,
} from "../services/deadlineService.js";

const dateTimeInput = z.string().datetime({ offset: true });

const dateInput = z.string().refine((value) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }
  return dateTimeInput.safeParse(value).success;
}, "Enter a valid ISO date or date-time");

const verifiedSourceTypes = ["OFFICIAL_SOURCE", "CONFIGURED", "RULE_DERIVED"];

const createSchema = z
  .object({
    caseId: z.string().refine(mongoose.isObjectIdOrHexString, "Invalid case ID"),
    title: z.string().trim().min(1).max(200),
    dueAt: dateInput,
    kind: z.enum(["STATUTORY", "CONFIGURED"]),
    dateBasis: z.enum(["USER_SUPPLIED", "RULE_DERIVED"]).default("USER_SUPPLIED"),
    sourceType: z.enum([
      "OFFICIAL_SOURCE",
      "CONFIGURED",
      "RULE_DERIVED",
      "AI_GENERATED",
      "USER_PROVIDED",
    ]),
    sourceDescription: z.string().trim().min(1).max(1000).optional(),
    sourceUrl: z.string().url().max(2048).optional(),
  })
  .strict()
  .refine(
    (value) =>
      (value.dateBasis === "RULE_DERIVED" &&
        value.sourceType === "RULE_DERIVED" &&
        Boolean(value.sourceDescription)) ||
      (value.dateBasis === "USER_SUPPLIED" && value.sourceType !== "RULE_DERIVED"),
    {
      path: ["sourceDescription"],
      message:
        "Date basis and source type must agree; rule-derived dates require a source description",
    },
  );

const updateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    dueAt: dateInput.optional(),
    kind: z.enum(["STATUTORY", "CONFIGURED"]).optional(),
    dateBasis: z.enum(["USER_SUPPLIED", "RULE_DERIVED"]).optional(),
    sourceType: z
      .enum(["OFFICIAL_SOURCE", "CONFIGURED", "RULE_DERIVED", "AI_GENERATED", "USER_PROVIDED"])
      .optional(),
    sourceDescription: z.string().trim().min(1).max(1000).nullable().optional(),
    sourceUrl: z.string().url().max(2048).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one editable field is required",
  });

const listQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(["UPCOMING", "DUE", "OVERDUE", "COMPLETED", "CANCELLED"]).optional(),
    caseId: z.string().refine(mongoose.isObjectIdOrHexString, "Invalid case ID").optional(),
  })
  .strict();

const statusSchema = z.object({ status: z.enum(["COMPLETED", "CANCELLED"]) }).strict();
const verifySchema = z
  .object({
    confirmation: z.literal("I reviewed the source and confirm this date manually."),
  })
  .strict();
const reminderSchema = z
  .object({
    scheduledAt: z.string().datetime({ offset: true }),
  })
  .strict();
const reminderStatusSchema = z.object({ status: z.literal("CANCELLED") }).strict();

function validationError(res, error) {
  return res.status(400).json({
    success: false,
    message: "Validation failed",
    errors: error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    })),
  });
}

function parseBody(schema, body, res) {
  const result = schema.safeParse(body);
  if (!result.success) {
    validationError(res, result.error);
    return null;
  }
  return result.data;
}

function toDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00.000Z`) : new Date(value);
}

function validId(id) {
  return mongoose.isObjectIdOrHexString(id);
}

function ownedFilter(req, id) {
  return { _id: id, user: req.auth.userId };
}

async function getOwnedCase(req, caseId) {
  return Case.findOne({ _id: caseId, user: req.auth.userId });
}

async function findOwnedDeadline(req, id) {
  return Deadline.findOne(ownedFilter(req, id));
}

async function attachCase(req, deadline) {
  const caseRecord = await Case.findOne({ _id: deadline.case, user: req.auth.userId });
  return caseRecord ? enrichDeadline(deadline, caseRecord) : null;
}

export const deadlineController = {
  async create(req, res) {
    const input = parseBody(createSchema, req.body, res);
    if (!input) return;
    const caseRecord = await getOwnedCase(req, input.caseId);
    if (!caseRecord) {
      return res.status(404).json({ success: false, message: "Case not found" });
    }

    const dueAt = toDate(input.dueAt);
    const calculation = calculateDeadlineDays(dueAt);
    const deadline = await Deadline.create({
      user: req.auth.userId,
      case: caseRecord._id,
      title: input.title,
      dueAt,
      kind: input.kind,
      dateBasis: input.dateBasis,
      status: calculation.status,
      sourceType: input.sourceType,
      sourceDescription: input.sourceDescription,
      sourceUrl: input.sourceUrl,
      verificationStatus: "UNVERIFIED",
    });
    await recordDeadlineEvent(
      req.auth.userId,
      caseRecord._id,
      calculation.status === "OVERDUE"
        ? `Deadline created already overdue according to the entered date: ${input.title} (unverified)`
        : `Deadline created: ${input.title} (unverified)`,
    );

    return res.status(201).json({
      success: true,
      message: "Deadline created as an unverified date; no statutory rule was calculated.",
      data: enrichDeadline(deadline, caseRecord),
    });
  },

  async list(req, res) {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) return validationError(res, parsed.error);
    await refreshDeadlineStatuses(req.auth.userId);

    const { page, limit, status, caseId } = parsed.data;
    const filter = { user: req.auth.userId };
    if (status) filter.status = status;
    if (caseId) {
      const caseRecord = await getOwnedCase(req, caseId);
      if (!caseRecord) {
        return res.status(404).json({ success: false, message: "Case not found" });
      }
      filter.case = caseId;
    }

    const [deadlines, total] = await Promise.all([
      Deadline.find(filter)
        .sort({ dueAt: 1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Deadline.countDocuments(filter),
    ]);
    const data = (await Promise.all(deadlines.map((deadline) => attachCase(req, deadline)))).filter(
      Boolean,
    );

    return res.status(200).json({
      success: true,
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  },

  async listForCase(req, res) {
    if (!validId(req.params.caseId)) {
      return res.status(400).json({ success: false, message: "Invalid case ID" });
    }
    const caseRecord = await getOwnedCase(req, req.params.caseId);
    if (!caseRecord) {
      return res.status(404).json({ success: false, message: "Case not found" });
    }
    await refreshDeadlineStatuses(req.auth.userId);
    const deadlines = await Deadline.find({ user: req.auth.userId, case: caseRecord._id }).sort({
      dueAt: 1,
    });
    return res.status(200).json({
      success: true,
      data: deadlines.map((deadline) => enrichDeadline(deadline, caseRecord)),
    });
  },

  async getById(req, res) {
    if (!validId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid deadline ID" });
    }
    await refreshDeadlineStatuses(req.auth.userId);
    const deadline = await findOwnedDeadline(req, req.params.id);
    if (!deadline) {
      return res.status(404).json({ success: false, message: "Deadline not found" });
    }
    const data = await attachCase(req, deadline);
    if (!data) {
      return res.status(404).json({ success: false, message: "Deadline not found" });
    }
    return res.status(200).json({ success: true, data });
  },

  async update(req, res) {
    if (!validId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid deadline ID" });
    }
    const input = parseBody(updateSchema, req.body, res);
    if (!input) return;
    const deadline = await findOwnedDeadline(req, req.params.id);
    if (!deadline) {
      return res.status(404).json({ success: false, message: "Deadline not found" });
    }

    const provenanceChanged = [
      "dueAt",
      "dateBasis",
      "sourceType",
      "sourceDescription",
      "sourceUrl",
    ].some((key) => input[key] !== undefined);
    const nextDateBasis = input.dateBasis ?? deadline.dateBasis;
    const nextSourceType = input.sourceType ?? deadline.sourceType;
    const nextSourceDescription =
      input.sourceDescription === null
        ? undefined
        : (input.sourceDescription ?? deadline.sourceDescription);
    if (
      nextDateBasis === "RULE_DERIVED" &&
      (nextSourceType !== "RULE_DERIVED" || !nextSourceDescription)
    ) {
      return res.status(400).json({
        success: false,
        message: "Rule-derived dates require sourceType RULE_DERIVED and a source description",
      });
    }
    if (nextSourceType === "RULE_DERIVED" && nextDateBasis !== "RULE_DERIVED") {
      return res.status(400).json({
        success: false,
        message: "sourceType RULE_DERIVED requires dateBasis RULE_DERIVED",
      });
    }

    for (const [key, value] of Object.entries(input)) {
      if (key === "dueAt") deadline.dueAt = toDate(value);
      else if (value === null) deadline.set(key, undefined);
      else deadline.set(key, value);
    }
    if (provenanceChanged) {
      deadline.verificationStatus = "UNVERIFIED";
      deadline.verifiedAt = undefined;
      deadline.verifiedBy = null;
      deadline.verificationMethod = undefined;
    }
    if (!["COMPLETED", "CANCELLED"].includes(deadline.status)) {
      deadline.status = calculateDeadlineDays(deadline.dueAt).status;
    }
    await deadline.save();
    await recordDeadlineEvent(
      req.auth.userId,
      deadline.case,
      `Deadline updated: ${deadline.title}`,
    );
    const data = await attachCase(req, deadline);
    if (!data) {
      return res.status(404).json({ success: false, message: "Deadline not found" });
    }
    return res.status(200).json({
      success: true,
      message: "Deadline updated; source verification was reset if date or provenance changed.",
      data,
    });
  },

  async updateStatus(req, res) {
    if (!validId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid deadline ID" });
    }
    const input = parseBody(statusSchema, req.body, res);
    if (!input) return;
    const deadline = await findOwnedDeadline(req, req.params.id);
    if (!deadline) {
      return res.status(404).json({ success: false, message: "Deadline not found" });
    }
    if (["COMPLETED", "CANCELLED"].includes(deadline.status)) {
      if (deadline.status === input.status) {
        return res.status(200).json({ success: true, data: await attachCase(req, deadline) });
      }
      return res.status(409).json({
        success: false,
        message: "A completed or cancelled deadline cannot change terminal status",
      });
    }
    const previousStatus = deadline.status;
    deadline.status = input.status;
    await deadline.save();
    await recordDeadlineEvent(
      req.auth.userId,
      deadline.case,
      `Deadline status changed from ${previousStatus} to ${input.status}`,
    );
    return res.status(200).json({
      success: true,
      message: "Deadline status updated",
      data: await attachCase(req, deadline),
    });
  },

  async verify(req, res) {
    if (!validId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid deadline ID" });
    }
    const input = parseBody(verifySchema, req.body, res);
    if (!input) return;
    const deadline = await findOwnedDeadline(req, req.params.id);
    if (!deadline) {
      return res.status(404).json({ success: false, message: "Deadline not found" });
    }
    if (!verifiedSourceTypes.includes(deadline.sourceType) || !deadline.sourceDescription) {
      return res.status(409).json({
        success: false,
        message: "A qualifying source description is required before user attestation",
      });
    }
    deadline.verificationStatus = "VERIFIED";
    deadline.verifiedAt = new Date();
    deadline.verifiedBy = req.auth.userId;
    deadline.verificationMethod = "USER_ATTESTED";
    await deadline.save();
    await recordDeadlineEvent(
      req.auth.userId,
      deadline.case,
      "Deadline source marked verified by user attestation; not independently validated",
    );
    return res.status(200).json({
      success: true,
      message: "Recorded as user-attested; NyaySetu has not independently verified the legal rule.",
      data: await attachCase(req, deadline),
    });
  },

  async scheduleReminder(req, res) {
    if (!validId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid deadline ID" });
    }
    const input = parseBody(reminderSchema, req.body, res);
    if (!input) return;
    const scheduledAt = new Date(input.scheduledAt);
    if (scheduledAt <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Reminder time must be in the future",
      });
    }
    const deadline = await findOwnedDeadline(req, req.params.id);
    if (!deadline) {
      return res.status(404).json({ success: false, message: "Deadline not found" });
    }
    if (["COMPLETED", "CANCELLED"].includes(deadline.status)) {
      return res.status(409).json({
        success: false,
        message: "Cannot schedule reminders for a completed or cancelled deadline",
      });
    }
    if (scheduledAt > deadline.dueAt) {
      return res.status(400).json({
        success: false,
        message: "Reminder time must be on or before the due date",
      });
    }
    deadline.reminders.push({ scheduledAt, status: "SCHEDULED" });
    await deadline.save();
    await recordDeadlineEvent(
      req.auth.userId,
      deadline.case,
      "Local reminder scheduled; no message will be sent",
    );
    return res.status(201).json({
      success: true,
      message: "Reminder scheduled locally; email/SMS delivery is not configured.",
      data: await attachCase(req, deadline),
    });
  },

  async cancelReminder(req, res) {
    if (!validId(req.params.id) || !validId(req.params.reminderId)) {
      return res.status(400).json({ success: false, message: "Invalid deadline or reminder ID" });
    }
    const input = parseBody(reminderStatusSchema, req.body, res);
    if (!input) return;
    const deadline = await findOwnedDeadline(req, req.params.id);
    if (!deadline) {
      return res.status(404).json({ success: false, message: "Deadline not found" });
    }
    const reminder = deadline.reminders.id(req.params.reminderId);
    if (!reminder) {
      return res.status(404).json({ success: false, message: "Reminder not found" });
    }
    if (reminder.status !== "SCHEDULED") {
      return res.status(409).json({ success: false, message: "Reminder is not scheduled" });
    }
    reminder.status = "CANCELLED";
    await deadline.save();
    await recordDeadlineEvent(req.auth.userId, deadline.case, "Local deadline reminder cancelled");
    return res.status(200).json({
      success: true,
      message: "Reminder cancelled; no message was sent.",
      data: await attachCase(req, deadline),
    });
  },

  async escalationEligibility(req, res) {
    if (!validId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid deadline ID" });
    }
    await refreshDeadlineStatuses(req.auth.userId);
    const deadline = await findOwnedDeadline(req, req.params.id);
    if (!deadline) {
      return res.status(404).json({ success: false, message: "Deadline not found" });
    }
    const caseRecord = await getOwnedCase(req, deadline.case);
    if (!caseRecord) {
      return res.status(404).json({ success: false, message: "Deadline not found" });
    }
    return res.status(200).json({
      success: true,
      data: {
        ...enrichDeadline(deadline, caseRecord),
      },
    });
  },
};
