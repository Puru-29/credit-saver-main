import type { Case, CaseStatus, Deadline } from "@/types";

export const CASE_TYPE_LABEL: Record<Case["type"], string> = {
  rti: "RTI Assistant",
  rights: "Rights Companion",
  civic_fix: "Civic Fix",
};

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  drafted: "Drafted",
  awaiting_review: "Awaiting Review",
  submitted: "Submitted",
  awaiting_response: "Awaiting Response",
  responded: "Responded",
  deadline_breached: "Deadline Breached",
  escalation_draft_ready: "Escalation Draft Ready",
  escalated: "Escalated",
  routed_legal_aid: "Routed to Legal Aid",
  closed: "Closed",
};

export function isValidDeadline(deadline: Deadline): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(deadline.dueDate) &&
    Number.isFinite(Date.parse(`${deadline.dueDate}T00:00:00Z`)) &&
    new Date(`${deadline.dueDate}T00:00:00Z`).toISOString().slice(0, 10) === deadline.dueDate
  );
}

export function formatDemoDate(value: string, includeTime = false): string {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = dateOnly ? new Date(`${value}T00:00:00Z`) : new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
    ...(includeTime ? { hour: "numeric", minute: "2-digit", timeZoneName: "short" as const } : {}),
  }).format(date);
}

export function daysUntil(deadline: Deadline, now = new Date()): number | null {
  if (!isValidDeadline(deadline)) return null;
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dueUtc = Date.parse(`${deadline.dueDate}T00:00:00Z`);
  return Math.ceil((dueUtc - todayUtc) / 86_400_000);
}

export function nextRecommendedAction(c: Case): string {
  switch (c.status) {
    case "drafted":
      return "Review the draft and add any missing details.";
    case "awaiting_review":
      return "Review the prepared materials before deciding whether to proceed.";
    case "submitted":
      return "Record a response or update when one is received.";
    case "awaiting_response":
      return "Check for an update; dates shown here are demo reminders only.";
    case "responded":
      return "Review the response and choose whether to close or seek a next step.";
    case "deadline_breached":
      return "Review the sample escalation draft; no action has been submitted.";
    case "escalation_draft_ready":
      return "Review the escalation draft and approve it only if appropriate.";
    case "escalated":
      return "Track updates; this demo status does not mean anything was filed.";
    case "routed_legal_aid":
      return "Contact the relevant legal-aid office independently to confirm options.";
    case "closed":
      return "This case is closed in the demo.";
  }
}

export function deadlineCountdownLabel(days: number): string {
  if (days < 0)
    return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} past simulated date`;
  if (days === 0) return "Simulated date is today";
  return `${days} day${days === 1 ? "" : "s"} remaining (simulated)`;
}
