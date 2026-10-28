import mongoose from "mongoose";
import { z } from "zod";
import Case from "../models/Case.js";

const caseTypes = ["RTI", "RIGHTS", "CIVIC"];
const caseStatuses = ["DRAFT", "OPEN", "IN_PROGRESS", "WAITING_FOR_RESPONSE", "RESOLVED", "CLOSED"];

const locationSchema = z
  .object({
    address: z.string().trim().max(500).optional(),
    locality: z.string().trim().max(200).optional(),
    city: z.string().trim().max(200).optional(),
    district: z.string().trim().max(200).optional(),
    state: z.string().trim().max(200).optional(),
    postalCode: z.string().trim().max(20).optional(),
    coordinates: z
      .object({
        latitude: z.number().min(-90).max(90).optional(),
        longitude: z.number().min(-180).max(180).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const authoritySchema = z
  .object({
    name: z.string().trim().max(200).optional(),
    department: z.string().trim().max(200).optional(),
    jurisdiction: z.string().trim().max(200).optional(),
    contactEmail: z.string().trim().email().max(254).optional(),
    source: z.string().trim().max(500).optional(),
  })
  .strict();

const createCaseSchema = z
  .object({
    type: z.enum(caseTypes),
    title: z.string().trim().min(3).max(200),
    summary: z.string().trim().max(5000).optional(),
    details: z.string().trim().max(20000).optional(),
    location: locationSchema.optional(),
    authority: authoritySchema.optional(),
  })
  .strict();

const updateCaseSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    summary: z.string().trim().max(5000).nullable().optional(),
    details: z.string().trim().max(20000).nullable().optional(),
    location: locationSchema.nullable().optional(),
    authority: authoritySchema.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one editable field is required",
  });

const statusSchema = z.object({ status: z.enum(caseStatuses) }).strict();

const transitions = {
  DRAFT: ["OPEN", "CLOSED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_RESPONSE", "RESOLVED", "CLOSED"],
  IN_PROGRESS: ["WAITING_FOR_RESPONSE", "RESOLVED", "CLOSED"],
  WAITING_FOR_RESPONSE: ["IN_PROGRESS", "RESOLVED", "CLOSED"],
  RESOLVED: ["IN_PROGRESS", "CLOSED"],
  CLOSED: [],
};

function parseBody(schema, body, res) {
  const result = schema.safeParse(body);
  if (result.success) return result.data;

  res.status(400).json({
    success: false,
    message: "Validation failed",
    errors: result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    })),
  });
  return null;
}

function validId(id) {
  return mongoose.isObjectIdOrHexString(id);
}

function caseResponse(caseRecord) {
  const result = caseRecord.toObject();
  delete result.user;
  delete result.__v;
  return result;
}

function ownedCaseQuery(req, id) {
  return { _id: id, user: req.auth.userId };
}

export const caseController = {
  async create(req, res) {
    const input = parseBody(createCaseSchema, req.body, res);
    if (!input) return;

    const caseRecord = await Case.create({
      ...input,
      user: req.auth.userId,
      status: "DRAFT",
      timeline: [{ type: "CREATED", title: "Case created" }],
    });

    return res.status(201).json({
      success: true,
      message: "Case created",
      data: caseResponse(caseRecord),
    });
  },

  async list(req, res) {
    const querySchema = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        type: z.enum(caseTypes).optional(),
        status: z.enum(caseStatuses).optional(),
      })
      .strict();
    const parsedQuery = querySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid query parameters",
        errors: parsedQuery.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const { page, limit, type, status } = parsedQuery.data;
    const filter = { user: req.auth.userId };
    if (type) filter.type = type;
    if (status) filter.status = status;

    const [cases, total] = await Promise.all([
      Case.find(filter)
        .sort({ updatedAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Case.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: cases.map(caseResponse),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  },

  async getById(req, res) {
    if (!validId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid case ID" });
    }

    const caseRecord = await Case.findOne(ownedCaseQuery(req, req.params.id));
    if (!caseRecord) {
      return res.status(404).json({ success: false, message: "Case not found" });
    }

    return res.status(200).json({ success: true, data: caseResponse(caseRecord) });
  },

  async update(req, res) {
    if (!validId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid case ID" });
    }
    const input = parseBody(updateCaseSchema, req.body, res);
    if (!input) return;

    const caseRecord = await Case.findOne(ownedCaseQuery(req, req.params.id));
    if (!caseRecord) {
      return res.status(404).json({ success: false, message: "Case not found" });
    }

    for (const [field, value] of Object.entries(input)) {
      if (value === null) {
        caseRecord.set(field, undefined);
      } else {
        caseRecord.set(field, value);
      }
    }
    await caseRecord.save();

    return res.status(200).json({
      success: true,
      message: "Case updated",
      data: caseResponse(caseRecord),
    });
  },

  async updateStatus(req, res) {
    if (!validId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid case ID" });
    }
    const input = parseBody(statusSchema, req.body, res);
    if (!input) return;

    const caseRecord = await Case.findOne(ownedCaseQuery(req, req.params.id));
    if (!caseRecord) {
      return res.status(404).json({ success: false, message: "Case not found" });
    }

    if (caseRecord.status === input.status) {
      return res.status(200).json({
        success: true,
        message: "Case status unchanged",
        data: caseResponse(caseRecord),
      });
    }
    if (!transitions[caseRecord.status].includes(input.status)) {
      return res.status(409).json({
        success: false,
        message: `Cannot change case status from ${caseRecord.status} to ${input.status}`,
      });
    }

    const previousStatus = caseRecord.status;
    caseRecord.status = input.status;
    caseRecord.timeline.push({
      type: "STATUS_CHANGED",
      title: `Status changed from ${previousStatus} to ${input.status}`,
    });
    await caseRecord.save();

    return res.status(200).json({
      success: true,
      message: "Case status updated",
      data: caseResponse(caseRecord),
    });
  },
};
