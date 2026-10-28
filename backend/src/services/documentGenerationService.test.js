import assert from "node:assert/strict";
import test from "node:test";
import { createDocumentGenerationService } from "./documentGenerationService.js";

const userId = "user-1";
const caseId = "case-1";

function makeService({ caseRecord } = {}) {
  const savedDocuments = [];
  const caseQueries = [];
  const timelineUpdates = [];
  const DocumentModel = {
    async create(document) {
      const saved = {
        ...document,
        _id: `document-${savedDocuments.length + 1}`,
        toObject() {
          return { ...this };
        },
      };
      savedDocuments.push(saved);
      return saved;
    },
  };
  const CaseModel = {
    findOne(filter) {
      caseQueries.push(filter);
      return {
        async select() {
          return caseRecord && filter.user === userId && filter._id === caseId &&
            (!filter.type || filter.type === caseRecord.type)
            ? caseRecord
            : null;
        },
      };
    },
    async updateOne(filter, update) {
      timelineUpdates.push({ filter, update });
      return { matchedCount: 1, modifiedCount: 1 };
    },
  };
  return {
    service: createDocumentGenerationService({ DocumentModel, CaseModel }),
    savedDocuments,
    caseQueries,
    timelineUpdates,
  };
}

test("generates and saves RTI application with a linked, owner-checked case", async () => {
  const caseRecord = {
    _id: caseId,
    type: "RTI",
    title: "Public works information",
    summary: "Information about a public works project.",
    details: "Please provide the recorded details about the public works project.",
    authority: { name: "User-recorded authority" },
  };
  const { service, savedDocuments, caseQueries, timelineUpdates } = makeService({ caseRecord });

  const document = await service.generateAndSave({
    userId,
    type: "RTI_APPLICATION",
    input: {
      caseId,
      description: "Please provide records about the public works project.",
    },
  });

  assert.equal(document.type, "RTI_APPLICATION");
  assert.equal(document.case, caseId);
  assert.equal(document.status, "DRAFT");
  assert.equal(document.verificationStatus, "UNVERIFIED");
  assert.equal(document.reviewRequired, true);
  assert.match(document.content, /not been submitted/i);
  assert.match(document.content, /User-recorded authority/);
  assert.deepEqual(caseQueries[0], { _id: caseId, user: userId, type: "RTI" });
  assert.equal(timelineUpdates.length, 1);
  assert.equal(savedDocuments.length, 1);
});

test("preserves supplied rights facts and explicit missing-detail placeholders", async () => {
  const { service } = makeService();
  const document = await service.generateAndSave({
    userId,
    type: "RIGHTS_LETTER",
    input: {
      category: "TENANT",
      facts: ["The water supply in the rented unit stopped on 12 October."],
      requestedAction: "Please restore the water supply or explain the next steps.",
    },
  });

  assert.match(document.content, /The water supply in the rented unit stopped on 12 October\./);
  assert.match(document.content, /\[Recipient — identify and verify\]/);
  assert.match(document.content, /\[Your name\]/);
  assert.equal(document.case, undefined);
  assert.equal(document.verificationStatus, "UNVERIFIED");
});

test("generates first appeal and civic drafts without inventing authorities or citations", async () => {
  const appeal = await makeService().service.generateAndSave({
    userId,
    type: "FIRST_APPEAL",
    input: {
      facts: ["The user reports that a response has not been received."],
      originalRequestReference: "User reference 123",
    },
  });
  const civic = await makeService().service.generateAndSave({
    userId,
    type: "CIVIC_COMPLAINT",
    input: {
      description: "A streetlight near the bus stop has not worked for several days.",
      category: "STREETLIGHTS",
      location: { city: "Sample City" },
    },
  });

  assert.match(appeal.content, /User reference 123/);
  assert.match(appeal.content, /\[Public authority — verify\]/);
  assert.match(appeal.content, /\[Add and verify relevant date\]/);
  assert.doesNotMatch(appeal.content, /\bSection\s+\d+/i);
  assert.match(civic.content, /streetlight near the bus stop/);
  assert.match(civic.content, /Sample City/);
  assert.match(civic.content, /\[Identify and verify the appropriate receiving office\]/);
  assert.equal(civic.type, "CIVIC_COMPLAINT");
});

test("rejects a missing or wrong-type owned case without saving a document", async () => {
  const { service, savedDocuments } = makeService({
    caseRecord: { _id: caseId, type: "CIVIC", title: "Civic issue" },
  });

  await assert.rejects(
    service.generateAndSave({
      userId,
      type: "RTI_APPLICATION",
      input: { caseId, description: "Please provide records about the project." },
    }),
    { statusCode: 404 },
  );
  assert.equal(savedDocuments.length, 0);
});
