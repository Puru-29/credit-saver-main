import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateDeadlineDays,
  calculateEscalationReviewEligibility,
} from "./deadlineService.js";

test("calculates upcoming, due, and overdue days by UTC calendar date", () => {
  const now = new Date("2026-10-28T09:00:00.000Z");

  assert.deepEqual(calculateDeadlineDays("2026-11-04T00:00:00.000Z", now), {
    status: "UPCOMING",
    daysRemaining: 7,
    daysOverdue: 0,
  });
  assert.deepEqual(calculateDeadlineDays("2026-10-28T23:59:00.000Z", now), {
    status: "DUE",
    daysRemaining: 0,
    daysOverdue: 0,
  });
  assert.deepEqual(calculateDeadlineDays("2026-10-26T00:00:00.000Z", now), {
    status: "OVERDUE",
    daysRemaining: 0,
    daysOverdue: 2,
  });
});

test("overdue eligibility is operational only and does not imply legal eligibility", () => {
  const overdueDeadline = {
    status: "OVERDUE",
    verificationStatus: "UNVERIFIED",
  };
  const eligible = calculateEscalationReviewEligibility(overdueDeadline, {
    status: "IN_PROGRESS",
  });
  const closed = calculateEscalationReviewEligibility(overdueDeadline, {
    status: "CLOSED",
  });

  assert.equal(eligible.eligibleForManualReview, true);
  assert.equal(eligible.actualLegalEligibilityDetermined, false);
  assert.equal(eligible.requiresDateVerification, true);
  assert.equal(closed.eligibleForManualReview, false);
});
