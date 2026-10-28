import { z } from "zod";

const categories = ["POTHOLES", "GARBAGE", "STREETLIGHTS", "DRAINAGE", "WATER_SUPPLY"];
const caseTypes = ["RTI", "RIGHTS", "CIVIC"];
const caseStatuses = ["DRAFT", "OPEN", "IN_PROGRESS", "WAITING_FOR_RESPONSE", "RESOLVED", "CLOSED"];
const imageMimeTypes = ["image/jpeg", "image/png", "image/webp"];
const confidenceSchema = z.number().finite().min(0).max(1);

const civicClassificationRequest = z
  .object({
    description: z.string().trim().min(10).max(10000),
    category: z.enum(categories).optional(),
  })
  .strict();

const authorityRecommendationRequest = z
  .object({
    category: z.enum(categories),
    description: z.string().trim().min(10).max(10000).optional(),
    location: z
      .object({
        city: z.string().trim().min(1).max(200).optional(),
        district: z.string().trim().min(1).max(200).optional(),
        state: z.string().trim().min(1).max(200).optional(),
      })
      .strict(),
  })
  .strict();

const civicImageAnalysisRequest = z
  .object({
    imageReference: z
      .string()
      .trim()
      .min(1)
      .max(512)
      .regex(
        /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/,
        "Image reference must be an opaque storage identifier",
      ),
    mimeType: z.enum(imageMimeTypes),
  })
  .strict();

const coordinatesSchema = z
  .object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
  })
  .strict()
  .transform(({ latitude, longitude }) => ({
    latitude: Math.round(latitude * 1000) / 1000,
    longitude: Math.round(longitude * 1000) / 1000,
  }));

const complaintCandidateSchema = z
  .object({
    description: z.string().trim().min(10).max(5000),
    category: z.enum(categories),
    location: coordinatesSchema.optional(),
  })
  .strict();

const duplicateSimilarityRequest = z
  .object({
    complaint: complaintCandidateSchema,
    candidates: z.array(complaintCandidateSchema).min(1).max(50),
  })
  .strict();

const deadlineRiskRequest = z
  .object({
    caseType: z.enum(caseTypes),
    caseStatus: z.enum(caseStatuses),
    daysRemaining: z.number().int().min(-3650).max(3650),
    deadlineVerificationStatus: z.enum(["VERIFIED", "UNVERIFIED"]),
    deadlineSourceType: z.enum([
      "OFFICIAL_SOURCE",
      "CONFIGURED",
      "RULE_DERIVED",
      "AI_GENERATED",
      "USER_PROVIDED",
    ]),
  })
  .strict();

const civicClassificationResponse = z
  .object({
    category: z.enum(categories),
    confidence: confidenceSchema,
    rationale: z.string().max(2000).optional(),
    modelVersion: z.string().max(100).optional(),
  })
  .strict();

const authorityRecommendationResponse = z
  .object({
    recommendations: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(200),
            jurisdiction: z.string().max(500).optional(),
            rationale: z.string().max(2000).optional(),
            confidence: confidenceSchema.optional(),
          })
          .strict(),
      )
      .max(10),
    modelVersion: z.string().max(100).optional(),
  })
  .strict();

const civicImageAnalysisResponse = z
  .object({
    imageReadable: z.boolean(),
    detectedDefects: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(100),
            confidence: confidenceSchema,
            boundingBox: z
              .object({
                x: confidenceSchema,
                y: confidenceSchema,
                width: confidenceSchema,
                height: confidenceSchema,
              })
              .strict()
              .optional(),
          })
          .strict(),
      )
      .max(100),
    modelVersion: z.string().max(100).optional(),
  })
  .strict();

const duplicateSimilarityResponse = z
  .object({
    matches: z
      .array(
        z
          .object({
            candidateIndex: z.number().int().min(0).max(49),
            similarity: confidenceSchema,
          })
          .strict(),
      )
      .max(50),
    modelVersion: z.string().max(100).optional(),
  })
  .strict();

const deadlineRiskResponse = z
  .object({
    riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "UNKNOWN"]),
    score: confidenceSchema.optional(),
    factors: z.array(z.string().max(500)).max(20).default([]),
    modelVersion: z.string().max(100).optional(),
  })
  .strict();

const operations = {
  classifyCivicComplaint: {
    path: "api/v1/civic/classify",
    request: civicClassificationRequest,
    response: civicClassificationResponse,
  },
  recommendAuthority: {
    path: "api/v1/civic/authority-recommendation",
    request: authorityRecommendationRequest,
    response: authorityRecommendationResponse,
  },
  analyzeCivicDefectImage: {
    path: "api/v1/civic/image-analysis",
    request: civicImageAnalysisRequest,
    response: civicImageAnalysisResponse,
  },
  findSimilarComplaints: {
    path: "api/v1/civic/duplicate-similarity",
    request: duplicateSimilarityRequest,
    response: duplicateSimilarityResponse,
  },
  predictDeadlineBreachRisk: {
    path: "api/v1/deadlines/breach-risk",
    request: deadlineRiskRequest,
    response: deadlineRiskResponse,
  },
};

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_TIMEOUT_MS = 30000;

function unavailable(reason) {
  const messages = {
    not_configured: "The ML service is not configured.",
    invalid_configuration: "The ML service URL configuration is invalid.",
    timeout: "The ML service did not respond before the request timed out.",
    service_unavailable: "The ML service is currently unavailable.",
    invalid_response: "The ML service returned a response in an unexpected format.",
  };
  return { status: "unavailable", reason, message: messages[reason] };
}

function configuredEndpoint(serviceUrl, path) {
  if (!serviceUrl?.trim()) return { error: "not_configured" };

  try {
    const base = new URL(serviceUrl);
    if (
      !["http:", "https:"].includes(base.protocol) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash
    ) {
      return { error: "invalid_configuration" };
    }

    const endpoint = new URL(path, `${base.href.replace(/\/+$/, "")}/`);
    return { endpoint };
  } catch {
    return { error: "invalid_configuration" };
  }
}

export function createMlService({
  getServiceUrl = () => process.env.ML_SERVICE_URL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = globalThis.fetch,
} = {}) {
  const requestTimeout = Number.isFinite(timeoutMs)
    ? Math.min(MAX_TIMEOUT_MS, Math.max(100, Math.trunc(timeoutMs)))
    : DEFAULT_TIMEOUT_MS;

  async function invoke(operation, input) {
    const parsedRequest = operation.request.safeParse(input);
    if (!parsedRequest.success) {
      return {
        status: "unavailable",
        reason: "invalid_request",
        message: "Input does not match the ML request contract.",
        errors: parsedRequest.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      };
    }

    const { endpoint, error } = configuredEndpoint(getServiceUrl(), operation.path);
    if (error) return unavailable(error);
    if (typeof fetchImpl !== "function") return unavailable("service_unavailable");

    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify(parsedRequest.data),
        signal: AbortSignal.timeout(requestTimeout),
      });
    } catch (requestError) {
      if (requestError?.name === "TimeoutError" || requestError?.name === "AbortError") {
        return unavailable("timeout");
      }
      return unavailable("service_unavailable");
    }

    if (!response.ok) return unavailable("service_unavailable");

    let body;
    try {
      body = await response.json();
    } catch {
      return unavailable("invalid_response");
    }

    const parsedResponse = operation.response.safeParse(body);
    if (!parsedResponse.success) return unavailable("invalid_response");

    const data = parsedResponse.data;
    if (operation === operations.recommendAuthority) {
      return {
        status: "available",
        data: { ...data, verificationStatus: "UNVERIFIED" },
      };
    }
    if (operation === operations.findSimilarComplaints) {
      if (
        data.matches.some((match) => match.candidateIndex >= parsedRequest.data.candidates.length)
      ) {
        return unavailable("invalid_response");
      }
      return {
        status: "available",
        data: { ...data, reviewRequired: true },
      };
    }
    if (operation === operations.predictDeadlineBreachRisk) {
      return {
        status: "available",
        data: {
          ...data,
          notice: "Model estimate only; not a legal determination or verified deadline assessment.",
        },
      };
    }
    return { status: "available", data };
  }

  return Object.freeze(
    Object.fromEntries(
      Object.entries(operations).map(([name, operation]) => [
        name,
        (input) => invoke(operation, input),
      ]),
    ),
  );
}

const mlService = createMlService();

export const classifyCivicComplaint = mlService.classifyCivicComplaint;
export const recommendAuthority = mlService.recommendAuthority;
export const analyzeCivicDefectImage = mlService.analyzeCivicDefectImage;
export const findSimilarComplaints = mlService.findSimilarComplaints;
export const predictDeadlineBreachRisk = mlService.predictDeadlineBreachRisk;
