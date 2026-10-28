import mongoose from "mongoose";
import { z } from "zod";
import CivicComplaint from "../models/CivicComplaint.js";
import Case from "../models/Case.js";
import {
  getAuthoritySuggestion,
  groupPotentialDuplicates,
} from "../services/civicService.js";

const categories = ["POTHOLES", "GARBAGE", "STREETLIGHTS", "DRAINAGE", "WATER_SUPPLY"];
const statuses = ["DRAFT", "OPEN", "IN_PROGRESS", "WAITING_FOR_RESPONSE", "RESOLVED", "CLOSED"];
const transitions = {
  DRAFT: ["OPEN", "CLOSED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_RESPONSE", "RESOLVED", "CLOSED"],
  IN_PROGRESS: ["WAITING_FOR_RESPONSE", "RESOLVED", "CLOSED"],
  WAITING_FOR_RESPONSE: ["IN_PROGRESS", "RESOLVED", "CLOSED"],
  RESOLVED: ["IN_PROGRESS", "CLOSED"],
  CLOSED: [],
};

const coordinatesSchema = z
  .object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
  })
  .strict();

const locationSchema = z
  .object({
    address: z.string().trim().max(500).optional(),
    locality: z.string().trim().max(200).optional(),
    city: z.string().trim().max(200).optional(),
    district: z.string().trim().max(200).optional(),
    state: z.string().trim().max(200).optional(),
    postalCode: z.string().trim().max(20).optional(),
    coordinates: coordinatesSchema,
  })
  .strict();

const imageSchema = z
  .object({
    filename: z
      .string()
      .trim()
      .max(255)
      .refine((value) => !/[\\/]/.test(value), "Filename must not contain a path")
      .optional(),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
    sizeBytes: z.number().int().min(1).max(10 * 1024 * 1024),
    storageProvider: z.enum(["LOCAL", "S3", "GCS", "AZURE", "OTHER"]).optional(),
    storageKey: z.string().trim().min(1).max(1024).optional(),
  })
  .strict();

const createSchema = z
  .object({
    description: z.string().trim().min(10).max(10000),
    category: z.enum(categories),
    location: locationSchema,
    images: z.array(imageSchema).max(5).default([]),
  })
  .strict();

const updateSchema = z
  .object({
    description: z.string().trim().min(10).max(10000).optional(),
    category: z.enum(categories).optional(),
    location: locationSchema.optional(),
    images: z.array(imageSchema).max(5).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one editable field is required",
  });

const authoritySchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    sourceDescription: z.string().trim().min(1).max(1000).optional(),
    sourceUrl: z.string().url().max(2048).optional(),
  })
  .strict();

const statusSchema = z.object({ status: z.enum(statuses) }).strict();
const listQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    category: z.enum(categories).optional(),
    status: z.enum(statuses).optional(),
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

function validId(id) {
  return mongoose.isObjectIdOrHexString(id);
}

function safeCase(record) {
  const result = record.toObject();
  delete result.user;
  delete result.__v;
  return result;
}

function safeComplaint(record) {
  const result = record.toObject();
  delete result.user;
  delete result.__v;
  if (result.case) {
    delete result.case.user;
    delete result.case.__v;
  }
  result.imageDetection = {
    active: false,
    message: "Image detection is not active; no image analysis has been performed.",
  };
  result.submissionStatus = "NOT_SUBMITTED";
  return result;
}

function ownedComplaintFilter(req, id) {
  return { _id: id, user: req.auth.userId };
}

async function findOwnedComplaint(req, id) {
  return CivicComplaint.findOne(ownedComplaintFilter(req, id)).populate({
    path: "case",
    match: { user: req.auth.userId, type: "CIVIC" },
  });
}

export const civicController = {
  async create(req, res) {
    const input = parseBody(createSchema, req.body, res);
    if (!input) return;

    const label = input.category.toLowerCase().replaceAll("_", " ");
    const caseRecord = await Case.create({
      user: req.auth.userId,
      type: "CIVIC",
      title: `${label}: ${input.description.slice(0, 150)}`,
      summary: input.description,
      details: input.description,
      status: "OPEN",
      location: input.location,
      timeline: [{ type: "CREATED", title: "Civic complaint created" }],
    });

    try {
      const complaint = await CivicComplaint.create({
        user: req.auth.userId,
        case: caseRecord._id,
        category: input.category,
        images: input.images,
      });
      return res.status(201).json({
        success: true,
        message: "Civic complaint recorded. It has not been submitted to an authority.",
        data: {
          ...safeComplaint({
            toObject: () => ({ ...complaint.toObject(), case: safeCase(caseRecord) }),
          }),
          authoritySuggestion: getAuthoritySuggestion(),
        },
      });
    } catch (error) {
      await Case.deleteOne({ _id: caseRecord._id, user: req.auth.userId });
      throw error;
    }
  },

  async list(req, res) {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) return validationError(res, parsed.error);
    const { page, limit, category, status } = parsed.data;
    const filter = { user: req.auth.userId };
    if (category) filter.category = category;
    if (status) {
      const matchingCases = await Case.find({
        user: req.auth.userId,
        type: "CIVIC",
        status,
      }).select("_id");
      filter.case = { $in: matchingCases.map((record) => record._id) };
    }

    const [complaints, total] = await Promise.all([
      CivicComplaint.find(filter)
        .populate({ path: "case", match: { user: req.auth.userId, type: "CIVIC" } })
        .sort({ updatedAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      CivicComplaint.countDocuments(filter),
    ]);
    const owned = complaints.filter((complaint) => complaint.case);
    return res.status(200).json({
      success: true,
      data: owned.map((complaint) => ({
        ...safeComplaint(complaint),
        authoritySuggestion: getAuthoritySuggestion(),
      })),
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
      return res.status(400).json({ success: false, message: "Invalid complaint ID" });
    }
    const complaint = await findOwnedComplaint(req, req.params.id);
    if (!complaint?.case) {
      return res.status(404).json({ success: false, message: "Civic complaint not found" });
    }
    return res.status(200).json({
      success: true,
      data: {
        ...safeComplaint(complaint),
        authoritySuggestion: getAuthoritySuggestion(),
      },
    });
  },

  async update(req, res) {
    if (!validId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid complaint ID" });
    }
    const input = parseBody(updateSchema, req.body, res);
    if (!input) return;
    const complaint = await findOwnedComplaint(req, req.params.id);
    if (!complaint?.case) {
      return res.status(404).json({ success: false, message: "Civic complaint not found" });
    }

    if (input.category !== undefined) complaint.category = input.category;
    if (input.description !== undefined) {
      complaint.case.title = `${complaint.category.toLowerCase().replaceAll("_", " ")}: ${input.description.slice(0, 150)}`;
      complaint.case.summary = input.description;
      complaint.case.details = input.description;
    }
    if (input.location !== undefined) complaint.case.location = input.location;
    if (input.images !== undefined) complaint.images = input.images;

    await Promise.all([complaint.save(), complaint.case.save()]);
    return res.status(200).json({
      success: true,
      message: "Civic complaint updated",
      data: safeComplaint(complaint),
    });
  },

  async assignAuthority(req, res) {
    if (!validId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid complaint ID" });
    }
    const input = parseBody(authoritySchema, req.body, res);
    if (!input) return;
    const complaint = await findOwnedComplaint(req, req.params.id);
    if (!complaint?.case) {
      return res.status(404).json({ success: false, message: "Civic complaint not found" });
    }

    complaint.authorityAssignment = {
      ...input,
      verificationStatus: "UNVERIFIED",
      recordedAt: new Date(),
    };
    complaint.case.authority = {
      name: input.name,
      source: (input.sourceDescription || "User-provided; unverified").slice(0, 500),
    };
    complaint.case.timeline.push({
      type: "NOTE",
      title: "Authority assignment recorded as unverified",
    });
    await Promise.all([complaint.save(), complaint.case.save()]);

    return res.status(200).json({
      success: true,
      message: "Authority information recorded as unverified; no complaint was sent.",
      data: {
        ...safeComplaint(complaint),
        authoritySuggestion: getAuthoritySuggestion(),
      },
    });
  },

  async updateStatus(req, res) {
    if (!validId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid complaint ID" });
    }
    const input = parseBody(statusSchema, req.body, res);
    if (!input) return;
    const complaint = await findOwnedComplaint(req, req.params.id);
    if (!complaint?.case) {
      return res.status(404).json({ success: false, message: "Civic complaint not found" });
    }
    if (complaint.case.status === input.status) {
      return res.status(200).json({
        success: true,
        message: "Complaint status unchanged",
        data: safeComplaint(complaint),
      });
    }
    if (!transitions[complaint.case.status]?.includes(input.status)) {
      return res.status(409).json({
        success: false,
        message: `Cannot change complaint status from ${complaint.case.status} to ${input.status}`,
      });
    }

    const previousStatus = complaint.case.status;
    complaint.case.status = input.status;
    complaint.case.timeline.push({
      type: "STATUS_CHANGED",
      title: `Civic complaint status changed from ${previousStatus} to ${input.status}`,
    });
    await complaint.case.save();
    return res.status(200).json({
      success: true,
      message: "Complaint status updated",
      data: safeComplaint(complaint),
    });
  },

  async listPotentialDuplicates(req, res) {
    const complaints = await CivicComplaint.find({ user: req.auth.userId })
      .populate({ path: "case", match: { user: req.auth.userId, type: "CIVIC" } })
      .sort({ createdAt: 1 });
    const owned = complaints.filter((complaint) => complaint.case);
    return res.status(200).json({
      success: true,
      data: {
        groups: groupPotentialDuplicates(owned),
        method: "CATEGORY_AND_DISTANCE_HEURISTIC",
        message:
          "Potential duplicates are suggestions for human review, based only on category and approximate location. No ML image detection is active.",
      },
    });
  },

  async getAuthoritySuggestion(_req, res) {
    return res.status(200).json({
      success: true,
      data: getAuthoritySuggestion(),
    });
  },
};
