import mongoose from "mongoose";
import { z } from "zod";
import Case from "../models/Case.js";
import CivicComplaint from "../models/CivicComplaint.js";
import RtiDraft from "../models/RtiDraft.js";
import {
  generateActionTakenRtiDraft,
  generateFirstAppealDraft,
  generateRtiApplication,
} from "../services/rtiService.js";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
  }, "Enter a valid calendar date");

const authoritySchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    sourceDescription: z.string().trim().min(1).max(1000).optional(),
    sourceUrl: z.string().url().max(2048).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one detail is required");

const receivingOfficeSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    pioName: z.string().trim().min(1).max(200).optional(),
    sourceDescription: z.string().trim().min(1).max(1000).optional(),
    sourceUrl: z.string().url().max(2048).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one detail is required");

const responseDeadlineSchema = z
  .object({
    dueDate: dateSchema,
    sourceType: z.enum(["USER_PROVIDED", "OFFICIAL_SOURCE", "AI_GENERATED"]),
    sourceDescription: z.string().trim().min(1).max(1000).optional(),
    sourceUrl: z.string().url().max(2048).optional(),
  })
  .strict();

const createDraftSchema = z
  .object({
    description: z.string().trim().min(10).max(10000),
    caseId: z.string().refine(mongoose.isObjectIdOrHexString, "Invalid case ID").optional(),
    authority: authoritySchema.optional(),
    receivingOffice: receivingOfficeSchema.optional(),
    submissionDate: dateSchema.optional(),
    responseDeadline: responseDeadlineSchema.optional(),
  })
  .strict();

const firstAppealSchema = z
  .object({
    grounds: z.string().trim().min(10).max(5000),
    originalRequestReference: z.string().trim().min(1).max(200).optional(),
  })
  .strict();

const actionTakenSchema = z.object({}).strict();

const updateDraftSchema = z
  .object({
    description: z.string().trim().min(10).max(10000).optional(),
    applicationText: z.string().trim().min(10).max(30000).optional(),
    caseId: z
      .string()
      .refine(mongoose.isObjectIdOrHexString, "Invalid case ID")
      .nullable()
      .optional(),
    authority: authoritySchema.nullable().optional(),
    receivingOffice: receivingOfficeSchema.nullable().optional(),
    submissionDate: dateSchema.nullable().optional(),
    responseDeadline: responseDeadlineSchema.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one editable field is required");

const listQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

function respondValidation(res, result) {
  return res.status(400).json({
    success: false,
    message: "Validation failed",
    errors: result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    })),
  });
}

function parseBody(schema, body, res) {
  const result = schema.safeParse(body);
  if (!result.success) {
    respondValidation(res, result);
    return null;
  }
  return result.data;
}

function dateOnlyToDate(value) {
  return value ? new Date(`${value}T00:00:00.000Z`) : undefined;
}

function normalizeMetadata(value, kind) {
  if (!value) return undefined;
  const { name, pioName, sourceDescription, sourceUrl } = value;
  return {
    ...(name ? { name } : {}),
    ...(kind === "receivingOffice" && pioName ? { pioName } : {}),
    ...(sourceDescription ? { sourceDescription } : {}),
    ...(sourceUrl ? { sourceUrl } : {}),
    verificationStatus: "UNVERIFIED",
  };
}

function normalizeDeadline(value) {
  if (!value) return undefined;
  return {
    dueAt: dateOnlyToDate(value.dueDate),
    sourceType: value.sourceType,
    ...(value.sourceDescription ? { sourceDescription: value.sourceDescription } : {}),
    ...(value.sourceUrl ? { sourceUrl: value.sourceUrl } : {}),
    verificationStatus: "UNVERIFIED",
  };
}

function safeDraft(draft) {
  const result = draft.toObject();
  delete result.user;
  delete result.__v;
  result.filingStatus = result.submission?.userReportedDate
    ? "USER_REPORTED_SUBMISSION_DATE"
    : "DRAFT_NOT_SUBMITTED";
  result.submittedByNyaySetu = false;
  return result;
}

async function validateOwnedRtiCase(caseId, userId) {
  if (!caseId) return null;
  const linkedCase = await Case.findOne({ _id: caseId, user: userId }).select("_id type");
  return linkedCase?.type === "RTI" ? linkedCase : null;
}

function validId(id) {
  return mongoose.isObjectIdOrHexString(id);
}

function validateSourceCase(caseRecord, complaint, res) {
  const details = caseRecord.details || caseRecord.summary || "";
  const hasLocation = Boolean(
    caseRecord.location?.address ||
      caseRecord.location?.locality ||
      caseRecord.location?.city ||
      caseRecord.location?.district ||
      caseRecord.location?.state,
  );
  const authorityName =
    caseRecord.authority?.name?.trim() || complaint.authorityAssignment?.name?.trim();
  const errors = [];

  if (details.trim().length < 20) {
    errors.push({
      field: "case.details",
      message: "Add at least 20 characters describing the issue before generating this draft",
    });
  }
  if (!hasLocation) {
    errors.push({
      field: "case.location",
      message: "Add at least one location detail before generating this draft",
    });
  }
  if (!complaint.category) {
    errors.push({ field: "complaint.category", message: "Civic issue category is required" });
  }
  if (!authorityName) {
    errors.push({
      field: "case.authority",
      message: "Add the user-identified authority; it will remain marked unverified",
    });
  }
  if (errors.length > 0) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
    return null;
  }

  return { details: details.trim(), authorityName };
}

function isOwnedRtiApplicationDraft(draft) {
  return draft?.kind === "APPLICATION";
}

function draftNotFound(res) {
  return res.status(404).json({ success: false, message: "RTI application draft not found" });
}

function caseNotFound(res) {
  return res.status(404).json({ success: false, message: "Civic case not found" });
}

function noDraftSubmissionMessage(kind) {
  return kind === "FIRST_APPEAL"
    ? "First-appeal draft saved for review. It has not been submitted."
    : "Action-taken request draft saved for review. It has not been submitted.";
}

function ownedDraftQuery(req, id) {
  return { _id: id, user: req.auth.userId };
}

export const rtiController = {
  async createDraft(req, res) {
    const input = parseBody(createDraftSchema, req.body, res);
    if (!input) return;

    if (input.caseId) {
      const linkedCase = await validateOwnedRtiCase(input.caseId, req.auth.userId);
      if (!linkedCase) {
        return res.status(404).json({
          success: false,
          message: "RTI case not found",
        });
      }
    }

    const authority = normalizeMetadata(input.authority, "authority");
    const receivingOffice = normalizeMetadata(input.receivingOffice, "receivingOffice");
    const draft = await RtiDraft.create({
      user: req.auth.userId,
      ...(input.caseId ? { case: input.caseId } : {}),
      description: input.description,
      applicationText: generateRtiApplication({
        description: input.description,
        authority,
        receivingOffice,
      }),
      ...(authority ? { authority } : {}),
      ...(receivingOffice ? { receivingOffice } : {}),
      submission: input.submissionDate
        ? {
            userReportedDate: dateOnlyToDate(input.submissionDate),
            status: "USER_REPORTED_DATE",
          }
        : { status: "NOT_RECORDED" },
      ...(input.responseDeadline
        ? { responseDeadline: normalizeDeadline(input.responseDeadline) }
        : {}),
    });

    return res.status(201).json({
      success: true,
      message: "RTI draft saved. It has not been submitted.",
      data: safeDraft(draft),
    });
  },

  async createFirstAppealDraft(req, res) {
    if (!validId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid RTI draft ID" });
    }
    const input = parseBody(firstAppealSchema, req.body, res);
    if (!input) return;

    const sourceDraft = await RtiDraft.findOne(ownedDraftQuery(req, req.params.id));
    if (!isOwnedRtiApplicationDraft(sourceDraft)) {
      return draftNotFound(res);
    }

    let linkedCase;
    if (sourceDraft.case) {
      linkedCase = await Case.findOne({
        _id: sourceDraft.case,
        user: req.auth.userId,
        type: "RTI",
      });
      if (!linkedCase) {
        return draftNotFound(res);
      }
    }

    const authorityName =
      sourceDraft.authority?.name ||
      sourceDraft.receivingOffice?.name ||
      linkedCase?.authority?.name ||
      "[Public authority — identify and verify]";
    const appeal = await RtiDraft.create({
      user: req.auth.userId,
      ...(sourceDraft.case ? { case: sourceDraft.case } : {}),
      parentDraft: sourceDraft._id,
      kind: "FIRST_APPEAL",
      status: "DRAFT",
      description: `Sample first appeal related to RTI draft ${sourceDraft._id}. Review and verify before use.`,
      applicationText: generateFirstAppealDraft({
        caseTitle: "the original RTI request",
        caseDetails: sourceDraft.description,
        authorityName,
        originalRequestReference: input.originalRequestReference,
        appealGrounds: input.grounds,
      }),
      ...(sourceDraft.authority
        ? { authority: normalizeMetadata(sourceDraft.authority, "authority") }
        : {}),
      ...(sourceDraft.receivingOffice
        ? { receivingOffice: normalizeMetadata(sourceDraft.receivingOffice, "receivingOffice") }
        : {}),
      submission: { status: "NOT_RECORDED" },
    });

    return res.status(201).json({
      success: true,
      message: noDraftSubmissionMessage("FIRST_APPEAL"),
      data: safeDraft(appeal),
    });
  },

  async createActionTakenDraft(req, res) {
    if (!validId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid case ID" });
    }
    const input = parseBody(actionTakenSchema, req.body ?? {}, res);
    if (!input) return;

    const caseRecord = await Case.findOne({
      _id: req.params.id,
      user: req.auth.userId,
      type: "CIVIC",
    });
    if (!caseRecord) {
      return caseNotFound(res);
    }
    if (!["OPEN", "IN_PROGRESS", "WAITING_FOR_RESPONSE"].includes(caseRecord.status)) {
      return res.status(409).json({
        success: false,
        message: "An action-taken request can only be prepared for an unresolved civic case",
      });
    }

    const complaint = await CivicComplaint.findOne({
      user: req.auth.userId,
      case: caseRecord._id,
    });
    if (!complaint) {
      return res.status(404).json({ success: false, message: "Civic case details not found" });
    }

    const source = validateSourceCase(caseRecord, complaint, res);
    if (!source) return;

    const location = caseRecord.location || {};
    const draft = await RtiDraft.create({
      user: req.auth.userId,
      case: caseRecord._id,
      kind: "ACTION_TAKEN_REQUEST",
      status: "DRAFT",
      description: `Sample action-taken information request related to civic case ${caseRecord.title}. Verify details before use.`,
      applicationText: generateActionTakenRtiDraft({
        caseTitle: caseRecord.title,
        caseDetails: source.details,
        category: complaint.category,
        location,
        authorityName: source.authorityName,
      }),
      receivingOffice: normalizeMetadata(
        {
          name: source.authorityName,
          sourceDescription:
            caseRecord.authority?.source || complaint.authorityAssignment?.sourceDescription,
        },
        "receivingOffice",
      ),
      submission: { status: "NOT_RECORDED" },
    });

    return res.status(201).json({
      success: true,
      message: noDraftSubmissionMessage("ACTION_TAKEN_REQUEST"),
      data: safeDraft(draft),
    });
  },

  async listDrafts(req, res) {
    const queryResult = listQuerySchema.safeParse(req.query);
    if (!queryResult.success) return respondValidation(res, queryResult);
    const { page, limit } = queryResult.data;
    const filter = { user: req.auth.userId };
    const [drafts, total] = await Promise.all([
      RtiDraft.find(filter)
        .sort({ updatedAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      RtiDraft.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: drafts.map(safeDraft),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  },

  async getDraft(req, res) {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid RTI draft ID" });
    }

    const draft = await RtiDraft.findOne(ownedDraftQuery(req, req.params.id));
    if (!draft) {
      return res.status(404).json({ success: false, message: "RTI draft not found" });
    }

    return res.status(200).json({ success: true, data: safeDraft(draft) });
  },

  async updateDraft(req, res) {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid RTI draft ID" });
    }
    const input = parseBody(updateDraftSchema, req.body, res);
    if (!input) return;

    const draft = await RtiDraft.findOne(ownedDraftQuery(req, req.params.id));
    if (!draft) {
      return res.status(404).json({ success: false, message: "RTI draft not found" });
    }

    if (input.caseId) {
      const linkedCase = await validateOwnedRtiCase(input.caseId, req.auth.userId);
      if (!linkedCase) {
        return res.status(404).json({ success: false, message: "RTI case not found" });
      }
    }

    if (input.description !== undefined) draft.description = input.description;
    if (input.caseId !== undefined) draft.case = input.caseId;
    if (input.authority !== undefined) {
      draft.authority = input.authority
        ? normalizeMetadata(input.authority, "authority")
        : undefined;
    }
    if (input.receivingOffice !== undefined) {
      draft.receivingOffice = input.receivingOffice
        ? normalizeMetadata(input.receivingOffice, "receivingOffice")
        : undefined;
    }
    if (input.submissionDate !== undefined) {
      draft.submission = input.submissionDate
        ? {
            userReportedDate: dateOnlyToDate(input.submissionDate),
            status: "USER_REPORTED_DATE",
          }
        : { status: "NOT_RECORDED" };
    }
    if (input.responseDeadline !== undefined) {
      draft.responseDeadline = input.responseDeadline
        ? normalizeDeadline(input.responseDeadline)
        : undefined;
    }

    if (input.description !== undefined && input.applicationText === undefined) {
      draft.applicationText = generateRtiApplication({
        description: draft.description,
        authority: draft.authority,
        receivingOffice: draft.receivingOffice,
      });
    } else if (input.applicationText !== undefined) {
      draft.applicationText = input.applicationText;
    }

    await draft.save();
    return res.status(200).json({
      success: true,
      message: "RTI draft saved. It has not been submitted.",
      data: safeDraft(draft),
    });
  },
};
