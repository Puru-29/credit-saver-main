import assert from "node:assert/strict";
import { once } from "node:events";
import jwt from "jsonwebtoken";
import test from "node:test";
import User from "./models/User.js";
import Case from "./models/Case.js";
import Document from "./models/Document.js";
import { createApp } from "./app.js";

const config = {
  nodeEnv: "test",
  clientOrigin: "http://localhost:8080",
  jwtSecret: "test-only-signing-secret-with-enough-length",
  jwtExpiresIn: "1h",
};
const userId = "507f1f77bcf86cd799439011";

async function startTestServer(t) {
  const app = createApp(config);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(
    () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
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

test("health endpoint returns the API running response", async (t) => {
  const baseUrl = await startTestServer(t);

  const { response, body } = await jsonRequest(baseUrl, "/api/health");

  assert.equal(response.status, 200);
  assert.deepEqual(body, { status: "ok", message: "NyaySetu API is running" });
});

test("registration validates input, hashes passwords, and returns a safe user", async (t) => {
  const baseUrl = await startTestServer(t);
  let createdUser;
  t.mock.method(User, "create", async (input) => {
    createdUser = {
      ...input,
      _id: userId,
      id: userId,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    return createdUser;
  });

  const invalid = await jsonRequest(baseUrl, "/api/auth/register", {
    method: "POST",
    body: { name: "A", email: "not-an-email", password: "short" },
  });
  assert.equal(invalid.response.status, 400);
  assert.equal(createdUser, undefined);

  const registered = await jsonRequest(baseUrl, "/api/auth/register", {
    method: "POST",
    body: { name: "Test User", email: "  TEST@example.test ", password: "test-password-123" },
  });

  assert.equal(registered.response.status, 201);
  assert.equal(createdUser.email, "test@example.test");
  assert.notEqual(createdUser.passwordHash, "test-password-123");
  assert.ok(createdUser.passwordHash.startsWith("$2"));
  assert.equal("passwordHash" in registered.body.user, false);
  assert.equal(typeof registered.body.token, "string");
});

test("login validates input, rejects invalid credentials, and accepts a matching password", async (t) => {
  const baseUrl = await startTestServer(t);
  let storedUser;
  t.mock.method(User, "create", async (input) => {
    storedUser = {
      ...input,
      _id: userId,
      id: userId,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    return storedUser;
  });
  const registration = await jsonRequest(baseUrl, "/api/auth/register", {
    method: "POST",
    body: { name: "Test User", email: "login@example.test", password: "test-password-123" },
  });
  assert.equal(registration.response.status, 201);

  t.mock.method(User, "findOne", (query) => ({
    select: async () => (query.email === storedUser.email ? storedUser : null),
  }));
  const invalid = await jsonRequest(baseUrl, "/api/auth/login", {
    method: "POST",
    body: { email: "login@example.test", password: "incorrect-password" },
  });
  assert.equal(invalid.response.status, 401);
  assert.deepEqual(invalid.body, { message: "Invalid email or password" });

  const valid = await jsonRequest(baseUrl, "/api/auth/login", {
    method: "POST",
    body: { email: "LOGIN@example.test", password: "test-password-123" },
  });
  assert.equal(valid.response.status, 200);
  assert.equal(valid.body.user.email, "login@example.test");
  assert.equal("passwordHash" in valid.body.user, false);
});

test("protected endpoints reject malformed and invalid JWTs", async (t) => {
  const baseUrl = await startTestServer(t);

  for (const token of ["not-a-jwt", jwt.sign({}, "wrong-test-secret", { subject: userId })]) {
    const { response, body } = await jsonRequest(baseUrl, "/api/cases", {
      headers: authHeaders(token),
    });
    assert.equal(response.status, 401);
    assert.equal(body.message, "Invalid or expired token");
  }
});

test("profile update requires authentication and changes only the validated name", async (t) => {
  const baseUrl = await startTestServer(t);
  const storedUser = {
    id: userId,
    _id: userId,
    name: "Original Name",
    email: "profile@example.test",
    passwordHash: "secret-hash-that-must-not-be-returned",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    async save() {},
  };
  t.mock.method(User, "findById", async (id) => {
    assert.equal(id, userId);
    return storedUser;
  });

  const unauthenticated = await jsonRequest(baseUrl, "/api/auth/me", {
    method: "PATCH",
    body: { name: "Updated Test Name" },
  });
  assert.equal(unauthenticated.response.status, 401);

  const invalid = await jsonRequest(baseUrl, "/api/auth/me", {
    method: "PATCH",
    headers: authHeaders(),
    body: { name: "A" },
  });
  assert.equal(invalid.response.status, 400);

  const forbidden = await jsonRequest(baseUrl, "/api/auth/me", {
    method: "PATCH",
    headers: authHeaders(),
    body: { name: "Updated Test Name", role: "admin", passwordHash: "attacker-value" },
  });
  assert.equal(forbidden.response.status, 400);
  assert.equal(storedUser.name, "Original Name");

  let saved = false;
  storedUser.save = async () => {
    saved = true;
  };
  const updated = await jsonRequest(baseUrl, "/api/auth/me", {
    method: "PATCH",
    headers: authHeaders(),
    body: { name: "  Updated Test Name  " },
  });

  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.message, "Profile updated");
  assert.equal(updated.body.user.name, "Updated Test Name");
  assert.equal(updated.body.user.email, "profile@example.test");
  assert.equal("passwordHash" in updated.body.user, false);
  assert.equal(storedUser.name, "Updated Test Name");
  assert.equal(saved, true);
});

test("case routes create only authenticated-user cases and validate status transitions", async (t) => {
  const baseUrl = await startTestServer(t);
  let created;
  t.mock.method(Case, "create", async (input) => {
    created = {
      ...input,
      _id: "507f1f77bcf86cd799439012",
      toObject() {
        return { ...this };
      },
    };
    return created;
  });
  t.mock.method(Case, "findOne", async () => created);

  const forgedOwner = await jsonRequest(baseUrl, "/api/cases", {
    method: "POST",
    headers: authHeaders(),
    body: { type: "RTI", title: "Test case", user: "another-user" },
  });
  assert.equal(forgedOwner.response.status, 400);
  assert.equal(created, undefined);

  const creation = await jsonRequest(baseUrl, "/api/cases", {
    method: "POST",
    headers: authHeaders(),
    body: { type: "RTI", title: "Test case" },
  });
  assert.equal(creation.response.status, 201);
  assert.equal(created.user, userId);
  assert.equal(created.status, "DRAFT");
  assert.equal("user" in creation.body.data, false);

  const invalidStatus = await jsonRequest(baseUrl, `/api/cases/${created._id}/status`, {
    method: "PATCH",
    headers: authHeaders(),
    body: { status: "UNKNOWN" },
  });
  assert.equal(invalidStatus.response.status, 400);

  const illegalTransition = await jsonRequest(baseUrl, `/api/cases/${created._id}/status`, {
    method: "PATCH",
    headers: authHeaders(),
    body: { status: "WAITING_FOR_RESPONSE" },
  });
  assert.equal(illegalTransition.response.status, 409);
});

test("case and document reads are scoped to the authenticated owner", async (t) => {
  const baseUrl = await startTestServer(t);
  let caseFilter;
  let documentFilter;
  t.mock.method(Case, "findOne", async (filter) => {
    caseFilter = filter;
    return null;
  });
  t.mock.method(Document, "findOne", async (filter) => {
    documentFilter = filter;
    return null;
  });

  const caseResponse = await jsonRequest(baseUrl, "/api/cases/507f1f77bcf86cd799439012", {
    headers: authHeaders(),
  });
  const documentResponse = await jsonRequest(baseUrl, "/api/documents/507f1f77bcf86cd799439013", {
    headers: authHeaders(),
  });

  assert.equal(caseResponse.response.status, 404);
  assert.equal(documentResponse.response.status, 404);
  assert.deepEqual(caseFilter, {
    _id: "507f1f77bcf86cd799439012",
    user: userId,
  });
  assert.deepEqual(documentFilter, {
    _id: "507f1f77bcf86cd799439013",
    user: userId,
  });
});

test("RTI draft route rejects invalid request data without persisting it", async (t) => {
  const baseUrl = await startTestServer(t);

  const { response, body } = await jsonRequest(baseUrl, "/api/rti/drafts", {
    method: "POST",
    headers: authHeaders(),
    body: { description: "too short", unexpectedField: "not allowed" },
  });

  assert.equal(response.status, 400);
  assert.equal(body.message, "Validation failed");
  assert.ok(body.errors.length > 0);
});

test("centralized error middleware returns a generic production response", async (t) => {
  const app = createApp(config);
  app.set("env", "production");
  t.mock.method(User, "findById", async () => {
    throw new Error("test-only internal failure detail");
  });

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(
    () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  const address = server.address();

  const { response, body } = await jsonRequest(`http://127.0.0.1:${address.port}`, "/api/auth/me", {
    headers: authHeaders(),
  });

  assert.equal(response.status, 500);
  assert.deepEqual(body, { error: "Internal Server Error" });
  assert.equal(JSON.stringify(body).includes("test-only internal failure detail"), false);
});
