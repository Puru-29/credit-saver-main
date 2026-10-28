import mongoose from "mongoose";
import { z } from "zod";
import { getEnabledRightsCategories } from "../config/rights.js";
import Case from "../models/Case.js";
import RightsDraft from "../models/RightsDraft.js";
import {
  generateFormalLetter,
  generateProceduralGuidance,
  getEvidenceChecklist,
} from "../services/rightsService.js";

const categorySchema = z
  .string()
  .refine(
    (category) => getEnabledRightsCategories().includes(category),
    "Unsupported or disabled rights matter category",
  );

const caseSchema = z
  .object({
    category: categorySchema,
    description: z.string().trim().min(10).max(10000),
    title: z.string().trim().min(3).max(200).optional(),
  })
  .strict();

const guidanceSchema = z
  .object({
    category: categorySchema,
    description: z.string().trim().min(10).max(10000),
    urgent: z.boolean().default(false),
  })
  .strict();

const letterSchema = z
  .object({
    category: categorySchema,
    facts: z.array(z.string().trim().min(1).max(2000)).min(1).max(30),
    requestedAction: z.string().trim().min(1).max(2000).optional(),
    recipient: z.string().trim().min(1).max(300).optional(),
    senderName: z.string().trim().min(1).max(200).optional(),
    urgent: z.boolean().default(false),
  })
  .strict();

const checklistSchema = z
  .object({
    category: categorySchema,
    urgent: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .default("false"),
  })
  .strict();

const saveDraftSchema = z
  .object({
    caseId: z.string().refine(mongoose.isObjectIdOrHexString, "Invalid case ID").optional(),
    category: categorySchema,
    kind: z.enum(["GUIDANCE", "FORMAL_LETTER"]),
    title: z.string().trim().min(1).max(200),
    content: z.string().trim().min(1).max(30000),
    description: z.string().trim().max(10000).optional(),
    facts: z.array(z.string().trim().min(1).max(2000)).max(30).optional(),
    requestedAction: z.string().trim().max(2000).optional(),
    urgent: z.boolean().default(false),
    verificationNotice: z.string().trim().min(1).max(2000),
  })
  .strict()
  .refine(
    (value) => value.kind !== "GUIDANCE" || Boolean(value.description),
    "A description is required when saving guidance",
  )
  .refine(
    (value) => value.kind !== "FORMAL_LETTER" || Boolean(value.facts?.length),
    "Facts are required when saving a formal letter",
  );

const listQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    category: categorySchema.optional(),
    kind: z.enum(["GUIDANCE", "FORMAL_LETTER"]).optional(),
  })
  .strict();

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

function safeCase(caseRecord) {
  const result = caseRecord.toObject();
  delete result.user;
  delete result.__v;
  return result;
}

function safeDraft(draft) {
  const result = draft.toObject();
  delete result.user;
  delete result.__v;
  return result;
}

function ownedDraftQuery(req, id) {
  return { _id: id, user: req.auth.userId };
}

async function validateOwnedRightsCase(caseId, userId) {
  return Case.findOne({ _id: caseId, user: userId, type: "RIGHTS" }).select("_id");
}

export const rightsController = {
  async createCase(req, res) {
    const input = parseBody(caseSchema, req.body, res);
    if (!input) return;
    const shortDescription = input.description.slice(0, 150).trim();
    const title =
      input.title ||
      `${input.category === "TENANT" ? "Tenant issue" : "Gig-worker/workplace issue"}: ${shortDescription}`;

    const record = await Case.create({
      user: req.auth.userId,
      type: "RIGHTS",
      title,
      summary: input.description,
      details: input.description,
      status: "DRAFT",
      timeline: [{ type: "CREATED", title: "Rights matter case created" }],
    });

    return res.status(201).json({
      success: true,
      message: "Rights matter case created",
      data: safeCase(record),
    });
  },

  generateGuidance(req, res) {
    const input = parseBody(guidanceSchema, req.body, res);
    if (!input) return;
    const draft = generateProceduralGuidance(input);
    return res.status(200).json({
      success: true,
      message: "Procedural guidance draft generated",
      data: { ...draft, category: input.category, urgent: input.urgent },
    });
  },

  generateLetter(req, res) {
    const input = parseBody(letterSchema, req.body, res);
    if (!input) return;
    const draft = generateFormalLetter(input);
    return res.status(200).json({
      success: true,
      message: "Formal letter draft generated",
      data: { ...draft, category: input.category, urgent: input.urgent },
    });
  },

  getChecklist(req, res) {
    const parsed = checklistSchema.safeParse(req.query);
    if (!parsed.success) return validationError(res, parsed.error);
    return res.status(200).json({
      success: true,
      data: getEvidenceChecklist(parsed.data),
    });
  },

  async saveDraft(req, res) {
    const input = parseBody(saveDraftSchema, req.body, res);
    if (!input) return;

    if (input.caseId) {
      const linkedCase = await validateOwnedRightsCase(input.caseId, req.auth.userId);
      if (!linkedCase) {
        return res.status(404).json({ success: false, message: "Rights case not found" });
      }
    }

    const record = await RightsDraft.create({
      user: req.auth.userId,
      ...(input.caseId ? { case: input.caseId } : {}),
      category: input.category,
      kind: input.kind,
      title: input.title,
      content: input.content,
      verificationNotice: input.verificationNotice,
      inputFacts: {
        ...(input.description ? { description: input.description } : {}),
        ...(input.facts ? { facts: input.facts } : {}),
        ...(input.requestedAction ? { requestedAction: input.requestedAction } : {}),
        urgent: input.urgent,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Draft saved",
      data: safeDraft(record),
    });
  },

  async listDrafts(req, res) {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) return validationError(res, parsed.error);
    const { page, limit, category, kind } = parsed.data;
    const filter = { user: req.auth.userId };
    if (category) filter.category = category;
    if (kind) filter.kind = kind;

    const [drafts, total] = await Promise.all([
      RightsDraft.find(filter)
        .sort({ updatedAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      RightsDraft.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: drafts.map(safeDraft),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  },

  async getDraft(req, res) {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid rights draft ID" });
    }
    const draft = await RightsDraft.findOne(ownedDraftQuery(req, req.params.id));
    if (!draft) {
      return res.status(404).json({ success: false, message: "Rights draft not found" });
    }
    return res.status(200).json({ success: true, data: safeDraft(draft) });
  },
};
