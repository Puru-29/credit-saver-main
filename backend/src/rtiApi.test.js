import assert from "node:assert/strict";
import { once } from "node:events";
import jwt from "jsonwebtoken";
import test from "node:test";
import Case from "./models/Case.js";
import CivicComplaint from "./models/CivicComplaint.js";
import RtiDraft from "./models/RtiDraft.js";
import { createApp } from "./app.js";

const config = {
  nodeEnv: "test",
  clientOrigin: "http://localhost:8080",
  jwtSecret: "test-only-signing-secret-with-enough-length",
  jwtExpiresIn: "1h",
};
const userId = "507f1f77bcf86cd799439011";
const draftId = "507f1f77bcf86cd799439021";
const privateDraftContent = "Private information from another user's RTI draft.";

async function startTestServer(t) {
  const server = createApp(config).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(
    () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  return `http://127.0.0.1:${server.address().port}`;
}

function authHeaders(token = jwt.sign({}, config.jwtSecret, { subject: userId })) {
  return { authorization: `Bearer ${token}` };
}

async function jsonRequest(baseUrl, path, { method = "GET", headers = {}, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { response, body: await response.json() };
}

function makeDraft(values = {}) {
  const draft = {
    _id: draftId,
    user: userId,
    kind: "APPLICATION",
    status: "DRAFT",
    description: "Request information about a fictional public project.",
    applicationText: "Fictional RTI application draft for testing.",
    submission: { status: "NOT_RECORDED" },
    ...values,
  };
  draft.toObject = function () {
    const { toObject: _toObject, save: _save, ...result } = this;
    return result;
  };
  draft.save ??= async () => {};
  return draft;
}

test("RTI draft routes require authentication", async (t) => {
  const baseUrl = await startTestServer(t);
  const requests = [
    { path: "/api/rti/drafts" },
    {
      path: "/api/rti/drafts",
      method: "POST",
      body: { description: "A sufficiently detailed fictional request." },
    },
    { path: `/api/rti/drafts/${draftId}` },
    {
      path: `/api/rti/drafts/${draftId}`,
      method: "PATCH",
      body: { applicationText: "Updated fictional RTI draft text." },
    },
  ];

  for (const request of requests) {
    const { response } = await jsonRequest(baseUrl, request.path, request);
    assert.equal(response.status, 401, `${request.method ?? "GET"} ${request.path}`);
  }
});

test("POST /api/rti/drafts creates a draft for the authenticated user", async (t) => {
  const baseUrl = await startTestServer(t);
  let createdInput;
  t.mock.method(RtiDraft, "create", async (input) => {
    createdInput = input;
    return makeDraft({ ...input, _id: draftId });
  });

  const { response, body } = await jsonRequest(baseUrl, "/api/rti/drafts", {
    method: "POST",
    headers: authHeaders(),
    body: {
      description: "Please provide fictional records about a public project.",
      authority: { name: "Example Public Authority" },
      receivingOffice: { pioName: "Example PIO" },
    },
  });

  assert.equal(response.status, 201);
  assert.equal(body.success, true);
  assert.match(body.message, /has not been submitted/i);
  assert.equal(createdInput.user, userId);
  assert.equal(createdInput.authority.verificationStatus, "UNVERIFIED");
  assert.equal(createdInput.receivingOffice.verificationStatus, "UNVERIFIED");
  assert.match(body.data.applicationText, /Please provide fictional records/);
  assert.equal(body.data.submittedByNyaySetu, false);
  assert.equal(body.data.filingStatus, "DRAFT_NOT_SUBMITTED");
  assert.equal("user" in body.data, false);
});

test("GET /api/rti/drafts returns only drafts matching the authenticated owner", async (t) => {
  const baseUrl = await startTestServer(t);
  let findFilter;
  let countFilter;
  const ownedDraft = makeDraft();
  const query = {
    sort() {
      return this;
    },
    skip() {
      return this;
    },
    limit() {
      return Promise.resolve([ownedDraft]);
    },
  };
  t.mock.method(RtiDraft, "find", (filter) => {
    findFilter = filter;
    return query;
  });
  t.mock.method(RtiDraft, "countDocuments", async (filter) => {
    countFilter = filter;
    return 1;
  });

  const { response, body } = await jsonRequest(baseUrl, "/api/rti/drafts", {
    headers: authHeaders(),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(findFilter, { user: userId });
  assert.deepEqual(countFilter, { user: userId });
  assert.deepEqual(body.data.map((draft) => draft._id), [draftId]);
  assert.equal(body.pagination.total, 1);
  assert.equal(body.data.some((draft) => draft.applicationText === privateDraftContent), false);
});

test("GET /api/rti/drafts/:id retrieves an owned draft", async (t) => {
  const baseUrl = await startTestServer(t);
  let findFilter;
  const ownedDraft = makeDraft();
  t.mock.method(RtiDraft, "findOne", async (filter) => {
    findFilter = filter;
    return ownedDraft;
  });

  const { response, body } = await jsonRequest(baseUrl, `/api/rti/drafts/${draftId}`, {
    headers: authHeaders(),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(findFilter, { _id: draftId, user: userId });
  assert.equal(body.data._id, draftId);
  assert.equal(body.data.applicationText, ownedDraft.applicationText);
  assert.equal("user" in body.data, false);
});

test("PATCH /api/rti/drafts/:id updates an owned draft", async (t) => {
  const baseUrl = await startTestServer(t);
  let findFilter;
  let saved = false;
  const ownedDraft = makeDraft({
    async save() {
      saved = true;
    },
  });
  t.mock.method(RtiDraft, "findOne", async (filter) => {
    findFilter = filter;
    return ownedDraft;
  });

  const updatedText = "Updated editable fictional RTI application text.";
  const { response, body } = await jsonRequest(baseUrl, `/api/rti/drafts/${draftId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: { applicationText: updatedText },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(findFilter, { _id: draftId, user: userId });
  assert.equal(ownedDraft.applicationText, updatedText);
  assert.equal(saved, true);
  assert.equal(body.data.applicationText, updatedText);
  assert.equal(body.data.submittedByNyaySetu, false);
});

test("another user's RTI draft cannot be retrieved or updated, and its content is not returned", async (t) => {
  const baseUrl = await startTestServer(t);
  const findFilters = [];
  t.mock.method(RtiDraft, "findOne", async (filter) => {
    findFilters.push(filter);
    return null;
  });

  const retrieved = await jsonRequest(baseUrl, `/api/rti/drafts/${draftId}`, {
    headers: authHeaders(),
  });
  const updated = await jsonRequest(baseUrl, `/api/rti/drafts/${draftId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: { applicationText: "Attempted unauthorized draft update." },
  });

  for (const result of [retrieved, updated]) {
    assert.equal(result.response.status, 404);
    assert.equal(JSON.stringify(result.body).includes(privateDraftContent), false);
    assert.equal(JSON.stringify(result.body).includes("Private information"), false);
  }
  assert.deepEqual(findFilters, [
    { _id: draftId, user: userId },
    { _id: draftId, user: userId },
  ]);
});

test("RTI endpoints reject invalid draft IDs and invalid create/update bodies", async (t) => {
  const baseUrl = await startTestServer(t);

  const invalidGetId = await jsonRequest(baseUrl, "/api/rti/drafts/not-an-object-id", {
    headers: authHeaders(),
  });
  const invalidUpdateId = await jsonRequest(baseUrl, "/api/rti/drafts/not-an-object-id", {
    method: "PATCH",
    headers: authHeaders(),
    body: { applicationText: "An otherwise valid draft text." },
  });
  const invalidCreate = await jsonRequest(baseUrl, "/api/rti/drafts", {
    method: "POST",
    headers: authHeaders(),
    body: {
      description: "short",
      unexpectedField: "not allowed",
    },
  });
  const invalidUpdate = await jsonRequest(baseUrl, `/api/rti/drafts/${draftId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: {},
  });

  for (const result of [invalidGetId, invalidUpdateId, invalidCreate, invalidUpdate]) {
    assert.equal(result.response.status, 400);
  }
});

test("dedicated RTI escalation-draft endpoints require authentication", async (t) => {
  const baseUrl = await startTestServer(t);
  const requests = [
    {
      path: `/api/rti/drafts/${draftId}/first-appeal`,
      method: "POST",
      body: { grounds: "A fictional basis for requesting review." },
    },
    {
      path: `/api/rti/cases/${draftId}/action-taken-request`,
      method: "POST",
    },
  ];

  for (const request of requests) {
    const { response } = await jsonRequest(baseUrl, request.path, request);
    assert.equal(response.status, 401);
  }
});

test("POST /api/rti/drafts/:id/first-appeal saves a linked review-only draft", async (t) => {
  const baseUrl = await startTestServer(t);
  const sourceCaseId = "507f1f77bcf86cd799439031";
  const sourceDraft = makeDraft({
    case: sourceCaseId,
    authority: {
      name: "User-recorded authority",
      verificationStatus: "UNVERIFIED",
    },
  });
  let sourceFilter;
  let caseFilter;
  let createdInput;
  t.mock.method(RtiDraft, "findOne", async (filter) => {
    sourceFilter = filter;
    return sourceDraft;
  });
  t.mock.method(Case, "findOne", async (filter) => {
    caseFilter = filter;
    return { _id: sourceCaseId, type: "RTI", authority: sourceDraft.authority };
  });
  t.mock.method(RtiDraft, "create", async (input) => {
    createdInput = input;
    return makeDraft({ ...input, _id: "507f1f77bcf86cd799439022" });
  });

  const grounds = "The original request did not receive a complete response.";
  const { response, body } = await jsonRequest(
    baseUrl,
    `/api/rti/drafts/${draftId}/first-appeal`,
    {
      method: "POST",
      headers: authHeaders(),
      body: { grounds, originalRequestReference: "USER-REFERENCE-123" },
    },
  );

  assert.equal(response.status, 201);
  assert.deepEqual(sourceFilter, { _id: draftId, user: userId });
  assert.deepEqual(caseFilter, { _id: sourceCaseId, user: userId, type: "RTI" });
  assert.equal(createdInput.user, userId);
  assert.equal(createdInput.kind, "FIRST_APPEAL");
  assert.equal(createdInput.status, "DRAFT");
  assert.equal(createdInput.case, sourceCaseId);
  assert.equal(createdInput.parentDraft, draftId);
  assert.match(createdInput.applicationText, new RegExp(grounds));
  assert.match(createdInput.applicationText, /USER-REFERENCE-123/);
  assert.match(createdInput.applicationText, /No statutory provision or appeal deadline has been supplied or verified/);
  assert.equal(body.data.kind, "FIRST_APPEAL");
  assert.equal(body.data.case, sourceCaseId);
  assert.equal(body.data.parentDraft, draftId);
  assert.equal(body.data.submittedByNyaySetu, false);
  assert.match(body.message, /not been submitted/i);
});

test("POST /api/rti/cases/:id/action-taken-request saves a linked review-only draft", async (t) => {
  const baseUrl = await startTestServer(t);
  const civicCaseId = "507f1f77bcf86cd799439032";
  let caseFilter;
  let complaintFilter;
  let createdInput;
  t.mock.method(Case, "findOne", async (filter) => {
    caseFilter = filter;
    return {
      _id: civicCaseId,
      user: userId,
      type: "CIVIC",
      title: "Fictional streetlight issue",
      details: "The streetlight beside the fictional town library has been out for several days.",
      location: { city: "Sample City" },
      authority: { name: "User-recorded municipal office" },
      status: "IN_PROGRESS",
    };
  });
  t.mock.method(CivicComplaint, "findOne", async (filter) => {
    complaintFilter = filter;
    return { category: "STREETLIGHTS" };
  });
  t.mock.method(RtiDraft, "create", async (input) => {
    createdInput = input;
    return makeDraft({ ...input, _id: "507f1f77bcf86cd799439023" });
  });

  const { response, body } = await jsonRequest(
    baseUrl,
    `/api/rti/cases/${civicCaseId}/action-taken-request`,
    { method: "POST", headers: authHeaders() },
  );

  assert.equal(response.status, 201);
  assert.deepEqual(caseFilter, { _id: civicCaseId, user: userId, type: "CIVIC" });
  assert.deepEqual(complaintFilter, { user: userId, case: civicCaseId });
  assert.equal(createdInput.user, userId);
  assert.equal(createdInput.kind, "ACTION_TAKEN_REQUEST");
  assert.equal(createdInput.status, "DRAFT");
  assert.equal(createdInput.case, civicCaseId);
  assert.match(createdInput.applicationText, /Sample City/);
  assert.match(createdInput.applicationText, /STREETLIGHTS/);
  assert.match(createdInput.applicationText, /unverified/i);
  assert.equal(createdInput.receivingOffice.verificationStatus, "UNVERIFIED");
  assert.equal(body.data.kind, "ACTION_TAKEN_REQUEST");
  assert.equal(body.data.case, civicCaseId);
  assert.equal(body.data.submittedByNyaySetu, false);
  assert.match(body.message, /not been submitted/i);
});

test("dedicated RTI draft endpoints do not expose inaccessible related records", async (t) => {
  const baseUrl = await startTestServer(t);
  t.mock.method(RtiDraft, "findOne", async () => null);
  t.mock.method(Case, "findOne", async () => null);

  const inaccessibleAppeal = await jsonRequest(
    baseUrl,
    `/api/rti/drafts/${draftId}/first-appeal`,
    {
      method: "POST",
      headers: authHeaders(),
      body: { grounds: "A fictional basis for requesting review." },
    },
  );
  const inaccessibleAction = await jsonRequest(
    baseUrl,
    "/api/rti/cases/507f1f77bcf86cd799439032/action-taken-request",
    { method: "POST", headers: authHeaders() },
  );

  for (const result of [inaccessibleAppeal, inaccessibleAction]) {
    assert.equal(result.response.status, 404);
    assert.doesNotMatch(JSON.stringify(result.body), /Private information|another user's/i);
  }
});

test("dedicated draft generation rejects inaccessible linked RTI cases and complaint records", async (t) => {
  const baseUrl = await startTestServer(t);
  const sourceCaseId = "507f1f77bcf86cd799439033";
  let createCount = 0;
  t.mock.method(RtiDraft, "findOne", async () =>
    makeDraft({
      case: sourceCaseId,
      authority: { name: "Private authority detail" },
    }),
  );
  t.mock.method(Case, "findOne", async (filter) => {
    if (filter.type === "RTI") return null;
    return {
      _id: filter._id,
      type: "CIVIC",
      title: "Fictional civic case",
      details: "The fictional civic issue has enough details to prepare a sample request.",
      location: { city: "Sample City" },
      authority: { name: "Example authority" },
      status: "OPEN",
    };
  });
  t.mock.method(CivicComplaint, "findOne", async () => null);
  t.mock.method(RtiDraft, "create", async () => {
    createCount += 1;
    return makeDraft();
  });

  const inaccessibleLinkedCase = await jsonRequest(
    baseUrl,
    `/api/rti/drafts/${draftId}/first-appeal`,
    {
      method: "POST",
      headers: authHeaders(),
      body: { grounds: "A fictional basis for requesting review." },
    },
  );
  const inaccessibleComplaint = await jsonRequest(
    baseUrl,
    `/api/rti/cases/${sourceCaseId}/action-taken-request`,
    { method: "POST", headers: authHeaders() },
  );

  assert.equal(inaccessibleLinkedCase.response.status, 404);
  assert.equal(inaccessibleComplaint.response.status, 404);
  assert.doesNotMatch(JSON.stringify(inaccessibleLinkedCase.body), /Private authority detail/);
  assert.equal(createCount, 0);
});

test("dedicated RTI draft endpoints reject invalid IDs, request bodies, and missing case facts", async (t) => {
  const baseUrl = await startTestServer(t);

  const invalidAppealId = await jsonRequest(
    baseUrl,
    "/api/rti/drafts/not-an-object-id/first-appeal",
    {
      method: "POST",
      headers: authHeaders(),
      body: { grounds: "A fictional basis for requesting review." },
    },
  );
  const invalidActionId = await jsonRequest(
    baseUrl,
    "/api/rti/cases/not-an-object-id/action-taken-request",
    { method: "POST", headers: authHeaders() },
  );
  const invalidAppealBody = await jsonRequest(
    baseUrl,
    `/api/rti/drafts/${draftId}/first-appeal`,
    {
      method: "POST",
      headers: authHeaders(),
      body: { grounds: "short", unexpected: true },
    },
  );
  const invalidActionBody = await jsonRequest(
    baseUrl,
    "/api/rti/cases/507f1f77bcf86cd799439032/action-taken-request",
    {
      method: "POST",
      headers: authHeaders(),
      body: { authority: "Unverified client-supplied authority" },
    },
  );

  assert.equal(invalidAppealId.response.status, 400);
  assert.equal(invalidActionId.response.status, 400);
  assert.equal(invalidAppealBody.response.status, 400);
  assert.equal(invalidActionBody.response.status, 400);

  t.mock.method(Case, "findOne", async () => ({
    _id: "507f1f77bcf86cd799439032",
    type: "CIVIC",
    title: "Incomplete civic case",
    details: "Too short.",
    location: {},
    status: "OPEN",
  }));
  t.mock.method(CivicComplaint, "findOne", async () => ({ category: "STREETLIGHTS" }));

  const missingFacts = await jsonRequest(
    baseUrl,
    "/api/rti/cases/507f1f77bcf86cd799439032/action-taken-request",
    { method: "POST", headers: authHeaders() },
  );
  assert.equal(missingFacts.response.status, 400);
  assert.equal(missingFacts.body.message, "Validation failed");
  assert.ok(missingFacts.body.errors.some((error) => error.field === "case.details"));
  assert.ok(missingFacts.body.errors.some((error) => error.field === "case.location"));
  assert.ok(missingFacts.body.errors.some((error) => error.field === "case.authority"));
});
