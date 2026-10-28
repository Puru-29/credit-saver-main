import Case from "../models/Case.js";
import CivicComplaint from "../models/CivicComplaint.js";
import Deadline from "../models/Deadline.js";
import DeadlineJobRun from "../models/DeadlineJobRun.js";
import RtiDraft from "../models/RtiDraft.js";
import { calculateDeadlineDays, refreshDeadlineStatuses } from "./deadlineService.js";
import {
  generateActionTakenRtiDraft,
  generateFirstAppealDraft,
} from "./rtiService.js";

const activeCaseStatuses = ["DRAFT", "OPEN", "IN_PROGRESS", "WAITING_FOR_RESPONSE"];
const submittedCivicCaseStatuses = ["OPEN", "IN_PROGRESS", "WAITING_FOR_RESPONSE"];
const reminderDays = new Set([7, 3, 1, 0]);
const verifiedSourceTypes = ["OFFICIAL_SOURCE", "CONFIGURED", "RULE_DERIVED"];

const defaultModels = { Case, CivicComplaint, Deadline, DeadlineJobRun, RtiDraft };
const MAX_RECORDED_ERRORS = 50;

function isVerifiedDeadline(deadline) {
  return (
    deadline.verificationStatus === "VERIFIED" &&
    deadline.verificationMethod === "USER_ATTESTED" &&
    Boolean(deadline.verifiedAt && deadline.verifiedBy && deadline.sourceDescription) &&
    verifiedSourceTypes.includes(deadline.sourceType) &&
    Boolean(deadline.dueAt)
  );
}

function safeErrorCode(error) {
  if (Number.isInteger(error?.code)) return `DB_${error.code}`;
  if (typeof error?.name === "string" && /^[A-Za-z]{1,60}$/.test(error.name)) {
    return error.name.toUpperCase();
  }
  return "UNKNOWN";
}

function addSafeError(result, stage, error) {
  if (result.errors.length < MAX_RECORDED_ERRORS) {
    result.errors.push({ stage, code: safeErrorCode(error) });
  }
}

async function recordTimelineEventOnce(
  models,
  userId,
  caseId,
  key,
  title,
  occurredAt,
  type = "DEADLINE",
) {
  const updated = await models.Case.updateOne(
    {
      _id: caseId,
      user: userId,
      "timeline.monitoringKey": { $ne: key },
    },
    {
      $push: {
        timeline: {
          type,
          title,
          monitoringKey: key,
          occurredAt,
        },
      },
    },
  );
  return updated.modifiedCount === 1;
}

async function findOrCreateAutomatedRtiDraft(models, automationKey, draft) {
  const existing = await models.RtiDraft.findOne({ automationKey });
  if (existing) return { draft: existing, created: false };

  try {
    const created = await models.RtiDraft.create({ ...draft, automationKey });
    return { draft: created, created: true };
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const duplicate = await models.RtiDraft.findOne({ automationKey });
    if (!duplicate) throw error;
    return { draft: duplicate, created: false };
  }
}

async function findOrCreateActionTakenCase(models, userId, civicCase, deadline) {
  const systemKey = `deadline:${deadline._id}:CIVIC_ACTION_TAKEN_CASE`;
  let rtiCase = await models.Case.findOne({ systemKey, user: userId, type: "RTI" });
  let created = false;

  if (!rtiCase) {
    const title = `Action-taken information request: ${civicCase.title}`.slice(0, 200);
    try {
      rtiCase = await models.Case.create({
        user: userId,
        type: "RTI",
        systemKey,
        title,
        summary: "Sample action-taken information request prepared from a linked civic complaint.",
        details: civicCase.details || civicCase.summary,
        status: "DRAFT",
        parentCase: civicCase._id,
        relatedCases: [civicCase._id],
        timeline: [
          {
            type: "CREATED",
            title: "Sample action-taken RTI case created for user review; not submitted",
          },
        ],
      });
      created = true;
    } catch (error) {
      if (error?.code !== 11000) throw error;
      rtiCase = await models.Case.findOne({ systemKey, user: userId, type: "RTI" });
      if (!rtiCase) throw error;
    }
  }

  await models.Case.updateOne(
    { _id: civicCase._id, user: userId, type: "CIVIC" },
    { $addToSet: { relatedCases: rtiCase._id } },
  );
  await models.Case.updateOne(
    { _id: rtiCase._id, user: userId, type: "RTI" },
    {
      $set: { parentCase: civicCase._id },
      $addToSet: { relatedCases: civicCase._id },
    },
  );

  return { rtiCase, created };
}

function canPrepareFirstAppeal(deadline, caseRecord) {
  return (
    isVerifiedDeadline(deadline) &&
    deadline.kind === "STATUTORY" &&
    deadline.status === "OVERDUE" &&
    caseRecord.type === "RTI" &&
    caseRecord.status === "WAITING_FOR_RESPONSE" &&
    typeof (caseRecord.details || caseRecord.summary) === "string" &&
    (caseRecord.details || caseRecord.summary).trim().length >= 20 &&
    Boolean(caseRecord.authority?.name?.trim()) &&
    Boolean(caseRecord.authority?.source?.trim())
  );
}

async function prepareFirstAppeal(models, userId, deadline, caseRecord) {
  const automationKey = `deadline:${deadline._id}:FIRST_APPEAL`;
  const details = (caseRecord.details || caseRecord.summary).trim();
  const authority = {
    name: caseRecord.authority.name,
    sourceDescription: caseRecord.authority.source,
    verificationStatus: "UNVERIFIED",
  };
  const content = generateFirstAppealDraft({
    caseTitle: caseRecord.title,
    caseDetails: details,
    authorityName: caseRecord.authority.name,
    deadlineDate: deadline.dueAt.toISOString().slice(0, 10),
  });

  return findOrCreateAutomatedRtiDraft(models, automationKey, {
    user: userId,
    case: caseRecord._id,
    kind: "FIRST_APPEAL",
    status: "DRAFT",
    description: `Sample first appeal draft based on case ${caseRecord.title}. User review and independent verification required.`,
    applicationText: content,
    authority,
    submission: { status: "NOT_RECORDED" },
  });
}

async function prepareActionTakenDraft(
  models,
  userId,
  deadline,
  civicCase,
  complaint,
  authority,
) {
  const location = civicCase.location || {};
  const authorityName = authority.name;
  const automationKey = `deadline:${deadline._id}:CIVIC_ACTION_TAKEN_REQUEST`;
  const { rtiCase, created: caseCreated } = await findOrCreateActionTakenCase(
    models,
    userId,
    civicCase,
    deadline,
  );
  const content = generateActionTakenRtiDraft({
    caseTitle: civicCase.title,
    caseDetails: (civicCase.details || civicCase.summary).trim(),
    category: complaint.category,
    location,
    authorityName: authority.name,
  });
  const result = await findOrCreateAutomatedRtiDraft(models, automationKey, {
    user: userId,
    case: rtiCase._id,
    kind: "ACTION_TAKEN_REQUEST",
    status: "DRAFT",
    description: `Sample action-taken information request related to ${civicCase.title}. Verify all details before use.`,
    applicationText: content,
    receivingOffice: {
      name: authorityName,
      sourceDescription: authority.source,
      verificationStatus: "UNVERIFIED",
    },
    submission: { status: "NOT_RECORDED" },
  });
  return { ...result, caseCreated };
}

function civicDetailsSufficient(civicCase, complaint) {
  const details = civicCase.details || civicCase.summary || "";
  const location = civicCase.location || {};
  const authorityName =
    civicCase.authority?.name || complaint?.authorityAssignment?.name;
  const authoritySource =
    civicCase.authority?.source || complaint?.authorityAssignment?.sourceDescription;
  const hasPlace = Boolean(
    location.address ||
      location.locality ||
      location.city ||
      location.district ||
      location.state,
  );
  return (
    typeof details === "string" &&
    details.trim().length >= 20 &&
    Boolean(complaint?.category) &&
    Boolean(location.coordinates) &&
    hasPlace &&
    Boolean(authorityName?.trim()) &&
    Boolean(authoritySource?.trim())
  );
}

async function prepareNextStep(models, userId, deadline, caseRecord, result, now) {
  const nextStepKey = `deadline:${deadline._id}:NEXT_STEP`;
  let nextRecommendedStep =
    "Review the recorded case details and independently verify the available procedural options. No filing or external submission has been made.";

  if (canPrepareFirstAppeal(deadline, caseRecord)) {
    const { created } = await prepareFirstAppeal(models, userId, deadline, caseRecord);
    nextRecommendedStep =
      "Review the sample first-appeal draft and independently verify the applicable procedure. Nothing has been filed.";
    if (created) result.counts.firstAppealDraftsPrepared += 1;
  } else if (
    isVerifiedDeadline(deadline) &&
    deadline.status === "OVERDUE" &&
    caseRecord.type === "CIVIC" &&
    submittedCivicCaseStatuses.includes(caseRecord.status)
  ) {
    const complaint = await models.CivicComplaint.findOne({
      user: userId,
      case: caseRecord._id,
    });
    if (civicDetailsSufficient(caseRecord, complaint)) {
      const authority = {
        name: caseRecord.authority?.name || complaint.authorityAssignment.name,
        source: caseRecord.authority?.source || complaint.authorityAssignment.sourceDescription,
      };
      const { created, caseCreated } = await prepareActionTakenDraft(
        models,
        userId,
        deadline,
        caseRecord,
        complaint,
        authority,
      );
      nextRecommendedStep =
        "Review the linked sample action-taken RTI draft. Verify the authority and case details; nothing has been sent.";
      if (created) result.counts.actionTakenDraftsPrepared += 1;
      if (caseCreated) result.counts.actionTakenCasesPrepared += 1;
      await recordTimelineEventOnce(
        models,
        userId,
        caseRecord._id,
        `deadline:${deadline._id}:CIVIC_ACTION_TAKEN_REQUEST`,
        "Sample action-taken RTI draft prepared for review; not submitted",
        now,
        "ESCALATION",
      );
    }
  }

  const update = await models.Deadline.updateOne(
    {
      _id: deadline._id,
      user: userId,
      "monitoring.nextStepKey": { $ne: nextStepKey },
    },
    {
      $set: {
        "monitoring.nextRecommendedStep": nextRecommendedStep,
        "monitoring.nextStepPreparedAt": now,
        "monitoring.nextStepKey": nextStepKey,
      },
    },
  );
  if (update.modifiedCount === 1) result.counts.nextStepsPrepared += 1;

  await recordTimelineEventOnce(
    models,
    userId,
    caseRecord._id,
    nextStepKey,
    nextRecommendedStep,
    now,
  );
  if (canPrepareFirstAppeal(deadline, caseRecord)) {
    await recordTimelineEventOnce(
      models,
      userId,
      caseRecord._id,
      `deadline:${deadline._id}:FIRST_APPEAL`,
      "Sample first-appeal draft prepared for review; not filed",
      now,
      "ESCALATION",
    );
  }
}

async function processDeadline(models, deadline, userId, now, result) {
  const caseRecord = await models.Case.findOne({
    _id: deadline.case,
    user: userId,
  });
  if (!caseRecord) return;

  const calculation = calculateDeadlineDays(deadline.dueAt, now);
  if (calculation.status === "UPCOMING" || calculation.status === "DUE") {
    result.counts.upcomingDeadlines += 1;
    if (reminderDays.has(calculation.daysRemaining)) {
      const key = `deadline:${deadline._id}:REMINDER:${calculation.daysRemaining}`;
      const recorded = await recordTimelineEventOnce(
        models,
        userId,
        caseRecord._id,
        key,
        calculation.daysRemaining === 0
          ? `Entered deadline date reached: ${deadline.title} (verification: ${deadline.verificationStatus})`
          : `Reminder: ${deadline.title} is ${calculation.daysRemaining} day(s) away (verification: ${deadline.verificationStatus})`,
        now,
      );
      if (recorded) result.counts.reminderEventsRecorded += 1;
    }
    return;
  }

  result.counts.overdueDeadlines += 1;
  if (!isVerifiedDeadline(deadline) || !activeCaseStatuses.includes(caseRecord.status)) return;
  await prepareNextStep(models, userId, deadline, caseRecord, result, now);
}

function newResult(startedAt) {
  return {
    startedAt,
    finishedAt: null,
    status: "SUCCEEDED",
    counts: {
      usersScanned: 0,
      deadlinesScanned: 0,
      upcomingDeadlines: 0,
      overdueDeadlines: 0,
      reminderEventsRecorded: 0,
      nextStepsPrepared: 0,
      firstAppealDraftsPrepared: 0,
      actionTakenDraftsPrepared: 0,
      actionTakenCasesPrepared: 0,
    },
    errors: [],
  };
}

export async function runDeadlineMonitoring({
  now = new Date(),
  models = defaultModels,
  refreshStatuses = refreshDeadlineStatuses,
} = {}) {
  const result = newResult(now);
  try {
    const users = await models.Deadline.distinct("user", {
      status: { $in: ["UPCOMING", "DUE", "OVERDUE"] },
    });

    for (const userId of users) {
      result.counts.usersScanned += 1;
      try {
        await refreshStatuses(userId, now);
      } catch (error) {
        addSafeError(result, "refresh_deadline_statuses", error);
      }

      let deadlines;
      try {
        deadlines = await models.Deadline.find({
          user: userId,
          status: { $in: ["UPCOMING", "DUE", "OVERDUE"] },
        });
      } catch (error) {
        addSafeError(result, "list_deadlines", error);
        continue;
      }

      for (const deadline of deadlines) {
        result.counts.deadlinesScanned += 1;
        try {
          await processDeadline(models, deadline, userId, now, result);
        } catch (error) {
          addSafeError(result, "process_deadline", error);
        }
      }
    }
  } catch (error) {
    addSafeError(result, "monitor_deadlines", error);
    result.status = "FAILED";
  }

  result.finishedAt = new Date();
  if (result.errors.length && result.status !== "FAILED") result.status = "PARTIAL";

  try {
    await models.DeadlineJobRun.create({
      job: "DEADLINE_MONITORING",
      startedAt: result.startedAt,
      finishedAt: result.finishedAt,
      status: result.status,
      counts: result.counts,
      errorRecords: result.errors,
    });
  } catch (error) {
    addSafeError(result, "persist_job_result", error);
    if (result.status === "SUCCEEDED") result.status = "PARTIAL";
  }

  return result;
}
