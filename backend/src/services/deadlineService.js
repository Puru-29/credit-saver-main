import { deadlineRules } from "../config/deadlineRules.js";
import Case from "../models/Case.js";
import Deadline from "../models/Deadline.js";

const activeStatuses = ["UPCOMING", "DUE"];

function utcDayStart(value) {
  const date = new Date(value);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function calculateDeadlineDays(dueAt, now = new Date()) {
  const difference = Math.round((utcDayStart(dueAt) - utcDayStart(now)) / 86_400_000);
  if (difference > 0) {
    return { status: "UPCOMING", daysRemaining: difference, daysOverdue: 0 };
  }
  if (difference === 0) {
    return { status: "DUE", daysRemaining: 0, daysOverdue: 0 };
  }
  return { status: "OVERDUE", daysRemaining: 0, daysOverdue: Math.abs(difference) };
}

export function calculateEscalationReviewEligibility(deadline, caseRecord) {
  const activeCase = caseRecord && !["RESOLVED", "CLOSED"].includes(caseRecord.status);
  const overdue = deadline.status === "OVERDUE";
  return {
    eligibleForManualReview: Boolean(overdue && activeCase),
    actualLegalEligibilityDetermined: false,
    requiresDateVerification: deadline.verificationStatus !== "VERIFIED",
    message:
      "This is an operational reminder only. It does not determine legal eligibility to appeal or escalate.",
  };
}

export function findConfiguredDeadlineRule(criteria) {
  return deadlineRules.find((rule) => rule.matches?.(criteria)) ?? null;
}

function eventForStatus(status) {
  const title =
    status === "OVERDUE"
      ? "Deadline marked overdue by date tracking"
      : status === "DUE"
        ? "Deadline date reached"
        : "Deadline status recalculated";
  return { type: "DEADLINE", title };
}

async function appendCaseEvent(userId, caseId, event) {
  const result = await Case.updateOne(
    { _id: caseId, user: userId },
    { $push: { timeline: event } },
  );
  if (result.matchedCount !== 1) {
    throw new Error("Cannot record deadline audit event: owned case was not found");
  }
}

export async function refreshDeadlineStatuses(userId, now = new Date()) {
  const deadlines = await Deadline.find({
    user: userId,
    status: { $in: [...activeStatuses, "OVERDUE"] },
  });
  let changed = 0;

  for (const deadline of deadlines) {
    const calculation = calculateDeadlineDays(deadline.dueAt, now);
    if (deadline.status === calculation.status) continue;

    const result = await Deadline.updateOne(
      { _id: deadline._id, user: userId, status: deadline.status },
      { $set: { status: calculation.status } },
    );
    if (result.modifiedCount === 1) {
      await appendCaseEvent(userId, deadline.case, eventForStatus(calculation.status));
      changed += 1;
    }
  }
  return changed;
}

export function enrichDeadline(deadline, caseRecord, now = new Date()) {
  const serialized = deadline.toObject();
  delete serialized.user;
  delete serialized.__v;
  const isTerminal = ["COMPLETED", "CANCELLED"].includes(deadline.status);
  const dayCounts = isTerminal
    ? { daysRemaining: null, daysOverdue: null }
    : calculateDeadlineDays(deadline.dueAt, now);

  return {
    ...serialized,
    ...dayCounts,
    ...(caseRecord
      ? { case: { id: caseRecord._id, title: caseRecord.title, status: caseRecord.status } }
      : {}),
    escalationReview: calculateEscalationReviewEligibility(deadline, caseRecord),
    legalDeadlineNotice:
      deadline.verificationStatus === "VERIFIED"
        ? "Date marked verified by user attestation; NyaySetu has not independently validated the legal rule."
        : "Unverified date only. No statutory deadline has been determined.",
  };
}

export async function recordDeadlineEvent(userId, caseId, title) {
  return appendCaseEvent(userId, caseId, {
    type: "DEADLINE",
    title,
  });
}
