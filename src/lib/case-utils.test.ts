import { describe, expect, it } from "vitest";
import { daysUntil, formatDate, isValidDeadline } from "@/lib/case-utils";
import type { Deadline } from "@/types";

const deadline = (dueDate: string): Deadline => ({
  id: "deadline_test",
  caseId: "case_test",
  label: "Simulated test date",
  dueDate,
  suggestedOffsetDays: 0,
  met: null,
  source: "simulated",
  sourceLabel: "Test-only simulated date",
});

describe("date utilities", () => {
  it("rejects malformed or impossible dates before showing countdowns", () => {
    expect(isValidDeadline(deadline("not-a-date"))).toBe(false);
    expect(isValidDeadline(deadline("2026-02-30"))).toBe(false);
    expect(daysUntil(deadline("not-a-date"))).toBeNull();
  });

  it("calculates countdowns by the shared UTC calendar date", () => {
    const now = new Date(Date.UTC(2026, 9, 28, 1));
    expect(daysUntil(deadline("2026-10-28"), now)).toBe(0);
    expect(daysUntil(deadline("2026-10-29"), now)).toBe(1);
    expect(daysUntil(deadline("2026-10-27"), now)).toBe(-1);
  });

  it("formats date-only values without shifting the calendar day", () => {
    expect(formatDate("2026-10-28")).toContain("28");
    expect(formatDate("invalid-date")).toBe("Date unavailable");
  });
});
