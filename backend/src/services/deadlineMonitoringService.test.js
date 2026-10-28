import assert from "node:assert/strict";
import test from "node:test";
import { runDeadlineMonitoring } from "./deadlineMonitoringService.js";

const userId = "user-1";
const now = new Date("2026-03-10T12:00:00.000Z");

function makeModels({ deadline, caseRecord, complaint } = {}) {
  const state = {
    deadlines: deadline ? [{ ...deadline, monitoring: { ...(deadline.monitoring || {}) } }] : [],
    cases: caseRecord ? [{ ...caseRecord, timeline: [...(caseRecord.timeline || [])] }] : [],
    complaints: complaint ? [complaint] : [],
    drafts: [],
    runs: [],
  };
  let nextCaseId = 1;

  const models = {
    Deadline: {
      async distinct() {
        return state.deadlines.length ? [userId] : [];
      },
      async find() {
        return state.deadlines.filter((item) =>
          ["UPCOMING", "DUE", "OVERDUE"].includes(item.status),
        );
      },
      async updateOne(filter, update) {
        const item = state.deadlines.find(
          (candidate) =>
            candidate._id === filter._id &&
            candidate.user === filter.user &&
            candidate.monitoring?.nextStepKey !==
              filter["monitoring.nextStepKey"]?.$ne,
        );
        if (!item) return { matchedCount: 0, modifiedCount: 0 };
        for (const [path, value] of Object.entries(update.$set || {})) {
          const [parent, child] = path.split(".");
          item[parent] ||= {};
          item[parent][child] = value;
        }
        return { matchedCount: 1, modifiedCount: 1 };
      },
    },
    Case: {
      async findOne(filter) {
        return state.cases.find((item) => {
          if (item.user !== filter.user) return false;
          if (filter.systemKey) return item.systemKey === filter.systemKey;
          return item._id === filter._id;
        }) || null;
      },
      async create(record) {
        const created = {
          ...record,
          _id: `generated-case-${nextCaseId++}`,
          timeline: [...(record.timeline || [])],
        };
        state.cases.push(created);
        return created;
      },
      async updateOne(filter, update) {
        const item = state.cases.find(
          (candidate) =>
            candidate._id === filter._id &&
            candidate.user === filter.user &&
            (!filter.type || candidate.type === filter.type),
        );
        if (!item) return { matchedCount: 0, modifiedCount: 0 };

        const timelineKey = filter["timeline.monitoringKey"]?.$ne;
        if (timelineKey) {
          if (item.timeline.some((event) => event.monitoringKey === timelineKey)) {
            return { matchedCount: 0, modifiedCount: 0 };
          }
          item.timeline.push(update.$push.timeline);
          return { matchedCount: 1, modifiedCount: 1 };
        }

        Object.assign(item, update.$set || {});
        for (const [key, value] of Object.entries(update.$addToSet || {})) {
          item[key] ||= [];
          if (!item[key].includes(value)) item[key].push(value);
        }
        return { matchedCount: 1, modifiedCount: 1 };
      },
    },
    CivicComplaint: {
      async findOne(filter) {
        return state.complaints.find(
          (item) => item.user === filter.user && item.case === filter.case,
        ) || null;
      },
    },
    RtiDraft: {
      async findOne(filter) {
        return state.drafts.find((item) => item.automationKey === filter.automationKey) || null;
      },
      async create(draft) {
        const created = { ...draft, _id: `draft-${state.drafts.length + 1}` };
        state.drafts.push(created);
        return created;
      },
    },
    DeadlineJobRun: {
      async create(run) {
        state.runs.push(run);
        return run;
      },
    },
  };

  return { models, state };
}

function makeDeadline(overrides = {}) {
  return {
    _id: "deadline-1",
    user: userId,
    case: "case-1",
    title: "Response date entered by user",
    dueAt: new Date("2026-03-13T00:00:00.000Z"),
    kind: "CONFIGURED",
    status: "UPCOMING",
    sourceType: "USER_PROVIDED",
    sourceDescription: "Entered by user",
    verificationStatus: "UNVERIFIED",
    ...overrides,
  };
}

function makeCase(overrides = {}) {
  return {
    _id: "case-1",
    user: userId,
    type: "RTI",
    title: "Information about a public project",
    details: "Please provide the recorded details about the public project and its progress.",
    status: "WAITING_FOR_RESPONSE",
    authority: { name: "Recorded public authority", source: "User-provided record" },
    ...overrides,
  };
}

test("records an upcoming reminder once across repeated monitoring runs", async () => {
  const { models, state } = makeModels({
    deadline: makeDeadline(),
    caseRecord: makeCase(),
  });
  const options = { now, models, refreshStatuses: async () => {} };

  const first = await runDeadlineMonitoring(options);
  const second = await runDeadlineMonitoring(options);

  assert.equal(first.counts.reminderEventsRecorded, 1);
  assert.equal(second.counts.reminderEventsRecorded, 0);
  assert.equal(state.cases[0].timeline.length, 1);
  assert.equal(state.runs.length, 2);
});

test("does not prepare procedural drafts from an unverified overdue date", async () => {
  const { models, state } = makeModels({
    deadline: makeDeadline({
      dueAt: new Date("2026-03-08T00:00:00.000Z"),
      status: "OVERDUE",
    }),
    caseRecord: makeCase(),
  });

  const result = await runDeadlineMonitoring({
    now,
    models,
    refreshStatuses: async () => {},
  });

  assert.equal(result.counts.overdueDeadlines, 1);
  assert.equal(result.counts.nextStepsPrepared, 0);
  assert.equal(state.drafts.length, 0);
});

test("prepares one review-only first appeal for an eligible verified RTI case", async () => {
  const { models, state } = makeModels({
    deadline: makeDeadline({
      dueAt: new Date("2026-03-08T00:00:00.000Z"),
      kind: "STATUTORY",
      status: "OVERDUE",
      sourceType: "OFFICIAL_SOURCE",
      verificationStatus: "VERIFIED",
      verifiedAt: new Date("2026-03-01T00:00:00.000Z"),
      verifiedBy: userId,
      verificationMethod: "USER_ATTESTED",
    }),
    caseRecord: makeCase(),
  });
  const options = { now, models, refreshStatuses: async () => {} };

  const first = await runDeadlineMonitoring(options);
  const second = await runDeadlineMonitoring(options);

  assert.equal(first.counts.firstAppealDraftsPrepared, 1);
  assert.equal(second.counts.firstAppealDraftsPrepared, 0);
  assert.equal(state.drafts.length, 1);
  assert.equal(state.drafts[0].kind, "FIRST_APPEAL");
  assert.match(state.drafts[0].applicationText, /NOT FILED/);
  assert.equal(state.cases[0].timeline.filter((event) => event.type === "ESCALATION").length, 1);
});

test("creates a linked action-taken RTI draft once for a sufficiently detailed civic case", async () => {
  const civicCase = makeCase({
    type: "CIVIC",
    status: "IN_PROGRESS",
    title: "Streetlight outage",
    details: "The streetlight has been out for several weeks near the community center.",
    authority: undefined,
    location: {
      address: "Near community center",
      city: "Sample City",
      coordinates: { latitude: 12.5, longitude: 77.5 },
    },
  });
  const { models, state } = makeModels({
    deadline: makeDeadline({
      dueAt: new Date("2026-03-08T00:00:00.000Z"),
      status: "OVERDUE",
      sourceType: "CONFIGURED",
      verificationStatus: "VERIFIED",
      verifiedAt: new Date("2026-03-01T00:00:00.000Z"),
      verifiedBy: userId,
      verificationMethod: "USER_ATTESTED",
    }),
    caseRecord: civicCase,
    complaint: {
      user: userId,
      case: civicCase._id,
      category: "STREETLIGHTS",
      authorityAssignment: {
        name: "User-recorded municipal office",
        sourceDescription: "User-provided, not verified",
      },
    },
  });
  const options = { now, models, refreshStatuses: async () => {} };

  const first = await runDeadlineMonitoring(options);
  const second = await runDeadlineMonitoring(options);
  const updatedCivicCase = state.cases.find((item) => item._id === civicCase._id);
  const rtiCase = state.cases.find((item) => item.type === "RTI");

  assert.equal(first.counts.actionTakenDraftsPrepared, 1);
  assert.equal(first.counts.actionTakenCasesPrepared, 1);
  assert.equal(second.counts.actionTakenDraftsPrepared, 0);
  assert.equal(state.drafts.length, 1);
  assert.equal(state.drafts[0].case, rtiCase._id);
  assert.equal(rtiCase.parentCase, civicCase._id);
  assert.ok(updatedCivicCase.relatedCases.includes(rtiCase._id));
  assert.match(state.drafts[0].applicationText, /NOT FILED/);
});

test("stores only sanitized error codes in job results", async () => {
  const state = { runs: [] };
  const models = {
    Deadline: {
      async distinct() {
        throw new Error("sensitive connection string must not be persisted");
      },
    },
    DeadlineJobRun: {
      async create(run) {
        state.runs.push(run);
      },
    },
  };

  const result = await runDeadlineMonitoring({ now, models });

  assert.equal(result.status, "FAILED");
  assert.equal(result.errors[0].stage, "monitor_deadlines");
  assert.equal(result.errors[0].code, "ERROR");
  assert.equal("message" in result.errors[0], false);
  assert.equal(JSON.stringify(state.runs).includes("sensitive"), false);
});
