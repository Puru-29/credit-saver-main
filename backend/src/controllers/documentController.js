import mongoose from "mongoose";
import { z } from "zod";
import { generateAndSaveDocument } from "../services/documentGenerationService.js";
import Document from "../models/Document.js";

const categories = ["TENANT", "GIG_WORKER_WORKPLACE"];
const civicCategories = ["POTHOLES", "GARBAGE", "STREETLIGHTS", "DRAINAGE", "WATER_SUPPLY"];

const optionalCaseId = z
  .string()
  .refine(mongoose.isObjectIdOrHexString, "Invalid case ID")
  .optional();
const optionalTitle = z.string().trim().min(1).max(200).optional();
const description = z.string().trim().min(10).max(10000);
const facts = z.array(z.string().trim().min(1).max(2000)).min(1).max(30);
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }, "Enter a valid calendar date");

const documentGenerationSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("RTI_APPLICATION"),
      caseId: optionalCaseId,
      title: optionalTitle,
      description,
      authority: z
        .object({
          name: z.string().trim().min(1).max(200).optional(),
        })
        .strict()
        .optional(),
      receivingOffice: z
        .object({
          name: z.string().trim().min(1).max(200).optional(),
          pioName: z.string().trim().min(1).max(200).optional(),
        })
        .strict()
        .optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("FIRST_APPEAL"),
      caseId: optionalCaseId,
      title: optionalTitle,
      facts,
      authorityName: z.string().trim().min(1).max(200).optional(),
      originalRequestReference: z.string().trim().min(1).max(200).optional(),
      date: dateOnly.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("RIGHTS_LETTER"),
      caseId: optionalCaseId,
      title: optionalTitle,
      category: z.enum(categories),
      facts,
      requestedAction: z.string().trim().min(1).max(2000).optional(),
      recipient: z.string().trim().min(1).max(300).optional(),
      senderName: z.string().trim().min(1).max(200).optional(),
      urgent: z.boolean().default(false),
    })
    .strict(),
  z
    .object({
      type: z.literal("CIVIC_COMPLAINT"),
      caseId: optionalCaseId,
      title: optionalTitle,
      description,
      category: z.enum(civicCategories),
      location: z
        .object({
          address: z.string().trim().max(500).optional(),
          locality: z.string().trim().max(200).optional(),
          city: z.string().trim().max(200).optional(),
          district: z.string().trim().max(200).optional(),
          state: z.string().trim().max(200).optional(),
          postalCode: z.string().trim().max(20).optional(),
        })
        .strict()
        .optional(),
      recipient: z.string().trim().min(1).max(300).optional(),
    })
    .strict(),
]);

const listQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    type: z
      .enum([
        "RTI_APPLICATION",
        "FIRST_APPEAL",
        "RIGHTS_LETTER",
        "CIVIC_COMPLAINT",
        "GRIEVANCE",
        "REPRESENTATION",
        "EVIDENCE",
        "OTHER",
      ])
      .optional(),
    status: z.enum(["DRAFT", "FINAL", "ARCHIVED"]).optional(),
    caseId: z.string().refine(mongoose.isObjectIdOrHexString, "Invalid case ID").optional(),
  })
  .strict();

const updateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    content: z
      .string()
      .min(1)
      .max(50000)
      .refine((value) => value.trim().length > 0, "Document content cannot be blank")
      .optional(),
    status: z.enum(["DRAFT", "FINAL"]).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one editable field is required",
  });

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

function safeDocument(document) {
  const result =
    typeof document.toObject === "function" ? document.toObject() : { ...document };
  delete result.user;
  delete result.__v;
  result.submissionStatus = "NOT_SUBMITTED";
  result.reviewNotice =
    result.verificationStatus === "USER_REVIEWED"
      ? "Marked reviewed by the user; not independently legally verified. This document has not been submitted."
      : "Draft requires user review. Facts, recipients, and any applicable procedure have not been independently verified.";
  return result;
}

export const documentController = {
  async generate(req, res) {
    const parsed = documentGenerationSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error);

    const document = await generateAndSaveDocument({
      userId: req.auth.userId,
      type: parsed.data.type,
      input: parsed.data,
    });

    return res.status(201).json({
      success: true,
      message: "Text draft generated and saved. It has not been filed or submitted.",
      data: safeDocument(document),
    });
  },

  async list(req, res) {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) return validationError(res, parsed.error);
    const { page, limit, type, status, caseId } = parsed.data;
    const filter = { user: req.auth.userId };
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (caseId) filter.case = caseId;

    const [documents, total] = await Promise.all([
      Document.find(filter)
        .sort({ updatedAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Document.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: documents.map(safeDocument),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  },

  async getById(req, res) {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid document ID" });
    }

    const document = await Document.findOne({
      _id: req.params.id,
      user: req.auth.userId,
    });
    if (!document) {
      return res.status(404).json({ success: false, message: "Document not found" });
    }

    return res.status(200).json({ success: true, data: safeDocument(document) });
  },

  async update(req, res) {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid document ID" });
    }
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error);

    const document = await Document.findOne({
      _id: req.params.id,
      user: req.auth.userId,
    });
    if (!document) {
      return res.status(404).json({ success: false, message: "Document not found" });
    }

    const input = parsed.data;
    const contentChanged = input.content !== undefined && input.content !== document.content;
    if (input.title !== undefined) document.title = input.title;
    if (input.content !== undefined) {
      document.content = input.content;
      document.sizeBytes = Buffer.byteLength(input.content, "utf8");
    }

    if (input.status !== undefined) {
      document.status = input.status;
      document.verificationStatus = input.status === "FINAL" ? "USER_REVIEWED" : "UNVERIFIED";
      document.reviewRequired = input.status !== "FINAL";
    } else if (contentChanged) {
      document.status = "DRAFT";
      document.verificationStatus = "UNVERIFIED";
      document.reviewRequired = true;
    }

    if (contentChanged) document.version += 1;
    await document.save();
    return res.status(200).json({
      success: true,
      message:
        document.status === "FINAL"
          ? "Document marked final by the user. This does not indicate independent verification or submission."
          : "Document draft updated",
      data: safeDocument(document),
    });
  },
};
