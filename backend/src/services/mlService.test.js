import assert from "node:assert/strict";
import test from "node:test";
import { createMlService } from "./mlService.js";

const serviceUrl = "http://127.0.0.1:8000";

function jsonResponse(body, { ok = true } = {}) {
  return {
    ok,
    async json() {
      return body;
    },
  };
}

test("validates request data and sends only the declared fields", async () => {
  let sent;
  const service = createMlService({
    getServiceUrl: () => serviceUrl,
    fetchImpl: async (url, options) => {
      sent = { url: url.toString(), options };
      return jsonResponse({
        category: "POTHOLES",
        confidence: 0.9,
      });
    },
  });

  const result = await service.classifyCivicComplaint({
    description: "There is a large pothole on the road near the local library.",
    category: "POTHOLES",
    email: "private@example.test",
  });

  assert.equal(result.status, "unavailable");
  assert.equal(result.reason, "invalid_request");
  assert.equal(sent, undefined);

  const validResult = await service.classifyCivicComplaint({
    description: "There is a large pothole on the road near the local library.",
    category: "POTHOLES",
  });

  assert.equal(validResult.status, "available");
  assert.equal(validResult.data.category, "POTHOLES");
  assert.equal(sent.url, `${serviceUrl}/api/v1/civic/classify`);
  assert.deepEqual(JSON.parse(sent.options.body), {
    description: "There is a large pothole on the road near the local library.",
    category: "POTHOLES",
  });
  assert.equal(sent.options.headers.authorization, undefined);
  assert.equal(sent.options.signal.aborted, false);
});

test("returns a clear unavailable status when no service URL is configured", async () => {
  const service = createMlService({ getServiceUrl: () => "" });
  const result = await service.classifyCivicComplaint({
    description: "There is a large pothole on the road near the local library.",
  });

  assert.deepEqual(result, {
    status: "unavailable",
    reason: "not_configured",
    message: "The ML service is not configured.",
  });
});

test("handles offline and timed-out service requests without throwing", async () => {
  const input = {
    caseType: "RTI",
    caseStatus: "WAITING_FOR_RESPONSE",
    daysRemaining: -3,
    deadlineVerificationStatus: "UNVERIFIED",
    deadlineSourceType: "USER_PROVIDED",
  };
  const offlineService = createMlService({
    getServiceUrl: () => serviceUrl,
    fetchImpl: async () => {
      throw new TypeError("private network error");
    },
  });
  const timeoutService = createMlService({
    getServiceUrl: () => serviceUrl,
    fetchImpl: async () => {
      const error = new Error("request timed out");
      error.name = "TimeoutError";
      throw error;
    },
  });

  assert.equal(
    (await offlineService.predictDeadlineBreachRisk(input)).reason,
    "service_unavailable",
  );
  assert.equal((await timeoutService.predictDeadlineBreachRisk(input)).reason, "timeout");
});

test("rejects malformed or out-of-scope ML responses", async () => {
  const invalidShapeService = createMlService({
    getServiceUrl: () => serviceUrl,
    fetchImpl: async () => jsonResponse({ category: "UNKNOWN", confidence: 1.4 }),
  });
  const unknownCandidateService = createMlService({
    getServiceUrl: () => serviceUrl,
    fetchImpl: async () =>
      jsonResponse({ matches: [{ candidateIndex: 1, similarity: 0.95 }] }),
  });
  const input = {
    complaint: {
      description: "Garbage has accumulated near the apartment entrance.",
      category: "GARBAGE",
    },
    candidates: [
      {
        description: "Garbage is piling up near the apartment entrance.",
        category: "GARBAGE",
      },
    ],
  };

  assert.equal(
    (await invalidShapeService.classifyCivicComplaint({
      description: "There is a large pothole on the road near the local library.",
    })).reason,
    "invalid_response",
  );
  assert.equal((await unknownCandidateService.findSimilarComplaints(input)).reason, "invalid_response");
});

test("sends rounded duplicate-location coordinates and rejects URL-based image references", async () => {
  let sentPayload;
  const service = createMlService({
    getServiceUrl: () => serviceUrl,
    fetchImpl: async (_url, options) => {
      sentPayload = JSON.parse(options.body);
      return jsonResponse({ matches: [] });
    },
  });
  const result = await service.findSimilarComplaints({
    complaint: {
      description: "Garbage has accumulated near the apartment entrance.",
      category: "GARBAGE",
      location: { latitude: 12.34567, longitude: 77.98765 },
    },
    candidates: [
      {
        description: "Garbage is piling up near the apartment entrance.",
        category: "GARBAGE",
        location: { latitude: 12.3456, longitude: 77.9876 },
      },
    ],
  });
  const invalidImage = await service.analyzeCivicDefectImage({
    imageReference: "https://storage.example/private?token=secret",
    mimeType: "image/jpeg",
  });

  assert.equal(result.status, "available");
  assert.deepEqual(sentPayload.complaint.location, { latitude: 12.346, longitude: 77.988 });
  assert.deepEqual(sentPayload.candidates[0].location, { latitude: 12.346, longitude: 77.988 });
  assert.equal(invalidImage.reason, "invalid_request");
});

test("labels authority recommendations and deadline risk as unverified estimates", async () => {
  const authorityService = createMlService({
    getServiceUrl: () => serviceUrl,
    fetchImpl: async () =>
      jsonResponse({
        recommendations: [{ name: "Municipal public works office", confidence: 0.7 }],
      }),
  });
  const riskService = createMlService({
    getServiceUrl: () => serviceUrl,
    fetchImpl: async () => jsonResponse({ riskLevel: "MEDIUM", score: 0.55 }),
  });

  const authority = await authorityService.recommendAuthority({
    category: "POTHOLES",
    location: { city: "Sample City" },
  });
  const risk = await riskService.predictDeadlineBreachRisk({
    caseType: "RTI",
    caseStatus: "WAITING_FOR_RESPONSE",
    daysRemaining: 3,
    deadlineVerificationStatus: "UNVERIFIED",
    deadlineSourceType: "USER_PROVIDED",
  });

  assert.equal(authority.data.verificationStatus, "UNVERIFIED");
  assert.match(risk.data.notice, /not a legal determination/);
});

test("returns unavailable rather than throwing for invalid service configuration or HTTP errors", async () => {
  const invalidConfiguration = createMlService({
    getServiceUrl: () => "file:///etc/passwd",
  });
  const httpError = createMlService({
    getServiceUrl: () => serviceUrl,
    fetchImpl: async () => jsonResponse({}, { ok: false }),
  });
  const input = {
    imageReference: "opaque-image-ref-123",
    mimeType: "image/jpeg",
  };

  assert.equal(
    (await invalidConfiguration.analyzeCivicDefectImage(input)).reason,
    "invalid_configuration",
  );
  assert.equal((await httpError.analyzeCivicDefectImage(input)).reason, "service_unavailable");
});
