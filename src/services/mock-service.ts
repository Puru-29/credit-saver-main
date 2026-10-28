// Mock service layer. State is shared in-memory for this browser session only.
import * as db from "@/data/mock-data";
import type { Case, CaseStatus, CaseType, Document, Escalation } from "@/types";
import { daysUntil, isValidDeadline } from "@/lib/case-utils";

const delay = <T>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 150));
const today = () => new Date().toISOString().slice(0, 10);
const dateOffset = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
let seq = 300;

const transitions: Record<CaseStatus, CaseStatus[]> = {
  drafted: ["awaiting_review", "closed"],
  awaiting_review: ["drafted", "submitted", "closed"],
  submitted: ["awaiting_response", "responded", "closed"],
  awaiting_response: ["responded", "closed"],
  responded: ["awaiting_response", "closed"],
  deadline_breached: ["escalation_draft_ready", "routed_legal_aid", "closed"],
  escalation_draft_ready: ["escalated", "routed_legal_aid", "closed"],
  escalated: ["responded", "routed_legal_aid", "closed"],
  routed_legal_aid: ["responded", "closed"],
  closed: [],
};

function appendEvent(
  caseId: string,
  type:
    | "created"
    | "submitted"
    | "response"
    | "deadline"
    | "escalation"
    | "note"
    | "status_change"
    | "document",
  title: string,
) {
  db.mockEvents.push({ id: `ev_${++seq}`, caseId, type, title, at: new Date().toISOString() });
}

function appendNotification(input: {
  title: string;
  body: string;
  caseId: string;
  category: "deadline" | "draft" | "response" | "escalation";
}) {
  db.mockNotifications.unshift({ id: `ntf_${++seq}`, ...input, at: today(), read: false });
}

export const caseService = {
  list: (userId = "usr_001") => delay(db.mockCases.filter((c) => c.userId === userId)),
  all: () => delay(db.mockCases),
  get: (id: string) => delay(db.mockCases.find((c) => c.id === id) ?? null),
  deadlines: (caseId: string) => delay(db.mockDeadlines.filter((d) => d.caseId === caseId)),
  allDeadlines: () => delay(db.mockDeadlines),
  allEvents: () => delay([...db.mockEvents].sort((a, b) => b.at.localeCompare(a.at))),
  events: (caseId: string) =>
    delay(
      db.mockEvents.filter((e) => e.caseId === caseId).sort((a, b) => a.at.localeCompare(b.at)),
    ),
  escalations: (caseId: string) => delay(db.mockEscalations.filter((e) => e.caseId === caseId)),
  allEscalations: () => delay(db.mockEscalations),
  approveEscalation: (id: string) => {
    const escalation = db.mockEscalations.find((item) => item.id === id);
    if (!escalation) throw new Error(`Escalation ${id} was not found`);
    if (escalation.status !== "draft")
      throw new Error("This escalation draft has already been approved");
    escalation.status = "approved";
    escalation.approvedAt = new Date().toISOString();
    const c = db.mockCases.find((item) => item.id === escalation.caseId);
    if (c) c.updatedAt = today();
    appendEvent(
      escalation.caseId,
      "escalation",
      "Demo escalation draft approved locally — not submitted",
    );
    appendNotification({
      title: "Escalation draft approved in demo",
      body: "Local approval only. Nothing was filed, sent or submitted.",
      caseId: escalation.caseId,
      category: "escalation",
    });
  },
  evidence: (caseId: string) => delay(db.mockEvidence.filter((e) => e.caseId === caseId)),
  related: (c: Case) =>
    delay(
      db.mockCases.filter(
        (other) =>
          other.id !== c.id && (other.parentCaseId === c.id || c.parentCaseId === other.id),
      ),
    ),
  transitions: (status: CaseStatus) => transitions[status],
  update: (id: string, patch: Pick<Case, "title" | "summary" | "authorityId">) => {
    const c = db.mockCases.find((item) => item.id === id);
    if (!c) throw new Error(`Case ${id} was not found`);
    Object.assign(c, patch, { updatedAt: today() });
    appendEvent(id, "note", "Case details updated in demo");
    return c;
  },
  transition: (id: string, status: CaseStatus) => {
    const c = db.mockCases.find((item) => item.id === id);
    if (!c) throw new Error(`Case ${id} was not found`);
    if (!transitions[c.status].includes(status))
      throw new Error(`Cannot change case status from ${c.status} to ${status}`);
    if (
      status === "escalation_draft_ready" &&
      !db.mockEscalations.some((item) => item.caseId === id && item.status === "draft")
    )
      throw new Error("Create a demo escalation draft before changing this case status");
    if (
      status === "escalated" &&
      !db.mockEscalations.some((item) => item.caseId === id && item.status === "approved")
    )
      throw new Error(
        "Review and locally approve an escalation draft before changing this demo status",
      );
    const previousStatus = c.status;
    c.status = status;
    c.updatedAt = today();
    appendEvent(
      id,
      "status_change",
      `Status changed from ${previousStatus.replaceAll("_", " ")} to ${status.replaceAll("_", " ")}`,
    );
    if (status === "responded")
      appendNotification({
        title: `Response update: ${c.title}`,
        body: "A response was recorded in the demo case. Review its details.",
        caseId: id,
        category: "response",
      });
    if (status === "escalation_draft_ready")
      appendNotification({
        title: `Escalation draft ready: ${c.title}`,
        body: "Review the sample draft before deciding what to do next.",
        caseId: id,
        category: "escalation",
      });
    return c;
  },
  canSimulateBreach: (c: Case) =>
    ["drafted", "awaiting_review", "submitted", "awaiting_response"].includes(c.status),
  simulateDeadlineBreach: (id: string) => {
    const c = db.mockCases.find((item) => item.id === id);
    if (!c) throw new Error(`Case ${id} was not found`);
    if (!caseService.canSimulateBreach(c))
      throw new Error("This case is not eligible for the demo deadline-breach simulation");

    const stamp = today();
    const simulatedDueDate = dateOffset(-1);
    const deadline = db.mockDeadlines.find((item) => item.caseId === id);
    if (deadline) {
      deadline.met = false;
      deadline.dueDate = simulatedDueDate;
      deadline.source = "simulated";
      deadline.sourceLabel = "Adjusted by the demo breach simulator — not a legal deadline";
    } else
      db.mockDeadlines.push({
        id: `dl_${++seq}`,
        caseId: id,
        label: "Simulated deadline breach marker",
        dueDate: simulatedDueDate,
        demoOffsetDays: 0,
        met: false,
        source: "simulated",
        sourceLabel: "Created by the demo breach simulator — not a legal deadline",
      });

    const level: Escalation["level"] =
      c.type === "rti"
        ? "first_appeal"
        : c.type === "civic_fix"
          ? "action_taken_request"
          : "next_step";
    const title =
      c.type === "rti"
        ? "Sample first-appeal draft"
        : c.type === "civic_fix"
          ? "Sample action-taken information request"
          : "Suggested next-step draft";
    const body =
      c.type === "rti"
        ? `Subject: Sample first appeal regarding ${c.title}\n\nI am requesting a review of the response status for my information request. Please review the request and provide a response or explain the current status.\n\n[DEMO DRAFT — not submitted. Confirm dates, authority and applicable requirements with an official source before use.]`
        : c.type === "civic_fix"
          ? `Subject: Request for an update on ${c.title}\n\nPlease review my earlier civic issue report and share what action, if any, has been taken, along with the current status.\n\n[DEMO DRAFT — not submitted. Confirm the office and details before use.]`
          : `Subject: Suggested next step regarding ${c.title}\n\nI am seeking a written update about the unresolved issue described in my case. Please review the matter and share the next steps available.\n\n[DEMO DRAFT — review with a qualified advisor where appropriate. Not submitted.]`;

    c.status = "deadline_breached";
    c.updatedAt = stamp;
    const draftDocumentId = `doc_${++seq}`;
    db.mockEscalations.unshift({
      id: `esc_${++seq}`,
      caseId: id,
      level,
      authorityId: c.authorityId,
      createdAt: stamp,
      status: "draft",
      draftContent: body,
      documentId: draftDocumentId,
    });
    db.mockDocuments.unshift({
      id: draftDocumentId,
      caseId: id,
      title,
      kind: "escalation",
      createdAt: stamp,
      status: "draft",
      content: body,
      plainLanguageContent:
        c.type === "rti"
          ? "A sample request asking for a review of the RTI request status."
          : c.type === "civic_fix"
            ? "A sample request asking what action has been taken on the civic issue."
            : "A suggested sample note asking about next steps for the unresolved issue.",
      demoSourcePlaceholder:
        "Demo source placeholder — no legal citation or verified source has been added.",
      citations: [
        { label: "No verified legal source attached to this demo draft", verified: false },
      ],
      versions: [
        {
          id: `ver_${++seq}`,
          savedAt: stamp,
          content: body,
          note: "Demo escalation draft created",
        },
      ],
    });
    appendEvent(id, "deadline", "Simulated deadline breach — demo only");
    appendEvent(id, "escalation", `${title} prepared for explicit review`);
    appendNotification({
      title: `Escalation draft awaiting review: ${c.title}`,
      body: "A demo-only escalation draft is ready. Review it before any action; nothing has been submitted.",
      caseId: id,
      category: "escalation",
    });
    return c;
  },
  createRelatedRti: (parentId: string) => {
    const parent = db.mockCases.find((item) => item.id === parentId);
    if (!parent || parent.type !== "civic_fix" || ["closed", "responded"].includes(parent.status)) {
      throw new Error("Only an unresolved Civic Fix case can create a related demo RTI case");
    }
    if (db.mockCases.some((item) => item.parentCaseId === parentId && item.type === "rti")) {
      throw new Error("A related demo RTI case already exists for this Civic Fix case");
    }
    const id = `case_${++seq}`;
    const stamp = today();
    const title = `Action taken information — ${parent.title}`;
    const summary = `Related demo RTI case requesting action-taken information about parent Civic Fix case ${parent.id}.`;
    db.mockCases.unshift({
      id,
      userId: parent.userId,
      type: "rti",
      title,
      summary,
      status: "awaiting_review",
      authorityId: parent.authorityId,
      createdAt: stamp,
      updatedAt: stamp,
      parentCaseId: parent.id,
    });
    db.mockDocuments.unshift({
      id: `doc_${++seq}`,
      caseId: id,
      title: "Action-taken information request draft",
      kind: "application",
      createdAt: stamp,
      status: "draft",
      content: `Subject: Information about action taken on ${parent.title}\n\nPlease share records showing the status and action taken on civic issue case ${parent.id} concerning: ${parent.summary}\n\n[DEMO WORKFLOW — this is an editable sample draft only. It has not been submitted.]`,
      plainLanguageContent: `Please share records showing whether action was taken on the civic issue in related case ${parent.id}.`,
      demoSourcePlaceholder: "Demo source placeholder — verify official requirements before use.",
      citations: [
        { label: "Official source reference not verified in this demo", verified: false },
      ],
      versions: [
        {
          id: `ver_${++seq}`,
          savedAt: stamp,
          content: "Initial related demo RTI draft.",
          note: "Created from Civic Fix case",
        },
      ],
    });
    appendEvent(id, "created", `Related demo RTI case created from ${parent.id}`);
    appendEvent(
      parent.id,
      "note",
      `Related demo RTI case ${id} created for action-taken information`,
    );
    appendNotification({
      title: `Related RTI draft created: ${parent.title}`,
      body: "Review the linked action-taken information request. It is a demo draft and was not submitted.",
      caseId: id,
      category: "draft",
    });
    return id;
  },
};

export const documentService = {
  list: () => delay(db.mockDocuments),
  get: (id: string) => delay(db.mockDocuments.find((d) => d.id === id) ?? null),
  save: (
    id: string,
    content: string,
    field: "content" | "plainLanguageContent" | "formalContent" = "content",
  ) => {
    const d = db.mockDocuments.find((item) => item.id === id);
    if (!d) throw new Error(`Document ${id} was not found`);
    if (!content.trim()) throw new Error("Document content cannot be empty");
    const stamp = today();
    d[field] = content;
    d.status = "draft";
    d.versions ??= [];
    d.versions.unshift({
      id: `ver_${++seq}`,
      savedAt: stamp,
      content,
      note: `Saved ${field === "content" ? "document" : field === "plainLanguageContent" ? "plain-language" : "formal"} draft`,
      field,
    });
    appendEvent(d.caseId, "document", `Document draft saved: ${d.title}`);
    appendNotification({
      title: `Draft saved: ${d.title}`,
      body: "Your changes are saved in this demo session.",
      caseId: d.caseId,
      category: "draft",
    });
    return d;
  },
};

export const authorityService = {
  get: (id: string) => db.mockAuthorities.find((a) => a.id === id),
  all: () => db.mockAuthorities,
  createManual: (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Enter an authority name");
    const existing = db.mockAuthorities.find(
      (authority) => authority.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) return existing.id;
    const id = `auth_demo_${++seq}`;
    db.mockAuthorities.push({
      id,
      name: trimmed,
      department: "Manually entered — demo only",
      jurisdiction: "Not verified",
    });
    return id;
  },
};
export const notificationService = {
  list: () => {
    const ensure = (
      id: string,
      input: {
        title: string;
        body: string;
        caseId: string;
        category: "deadline" | "draft" | "response" | "escalation";
      },
    ) => {
      if (!db.mockNotifications.some((item) => item.id === id))
        db.mockNotifications.unshift({ id, ...input, at: today(), read: false });
    };
    for (const deadline of db.mockDeadlines) {
      if (
        isValidDeadline(deadline) &&
        deadline.source === "simulated" &&
        (daysUntil(deadline) ?? 99) >= 0 &&
        (daysUntil(deadline) ?? 99) <= 7
      ) {
        const c = db.mockCases.find((item) => item.id === deadline.caseId);
        if (c)
          ensure(`auto_deadline_${deadline.id}`, {
            title: `Upcoming demo date: ${c.title}`,
            body: `${deadline.label} is marked for ${deadline.dueDate}. This is a simulated reminder, not a verified filing deadline.`,
            caseId: c.id,
            category: "deadline",
          });
      }
    }
    for (const doc of db.mockDocuments.filter((item) => item.status === "draft")) {
      ensure(`auto_draft_${doc.id}`, {
        title: `Saved draft: ${doc.title}`,
        body: "A sample document draft is available for review.",
        caseId: doc.caseId,
        category: "draft",
      });
    }
    for (const escalation of db.mockEscalations.filter((item) => item.status === "draft")) {
      const c = db.mockCases.find((item) => item.id === escalation.caseId);
      if (c)
        ensure(`auto_escalation_${escalation.id}`, {
          title: `Escalation awaiting review: ${c.title}`,
          body: "Review this sample draft. It has not been submitted.",
          caseId: c.id,
          category: "escalation",
        });
    }
    return delay(db.mockNotifications);
  },
  markRead: (id: string, read: boolean) => {
    const notification = db.mockNotifications.find((item) => item.id === id);
    if (!notification) throw new Error(`Notification ${id} was not found`);
    notification.read = read;
  },
  markAllRead: () =>
    db.mockNotifications.forEach((item) => {
      item.read = true;
    }),
};
export const userService = { current: () => db.mockUsers[0]!, all: () => delay(db.mockUsers) };

export function createCase(input: {
  type: CaseType;
  title: string;
  summary: string;
  authorityId: string;
  documentTitle: string;
  documentKind: Document["kind"];
  dueInDays: number;
  documentContent?: string;
  evidenceFileName?: string;
}) {
  if (!input.title.trim() || !input.summary.trim())
    throw new Error("A case title and summary are required");
  if (!db.mockAuthorities.some((authority) => authority.id === input.authorityId))
    throw new Error("Choose a valid authority before creating the case");
  if (!Number.isInteger(input.dueInDays) || input.dueInDays < 0 || input.dueInDays > 3650)
    throw new Error("The suggested demo follow-up offset must be between 0 and 3650 days");
  const id = `case_${++seq}`;
  const stamp = today();
  const due = dateOffset(input.dueInDays);
  const documentContent =
    input.documentContent ??
    "[DEMO TEMPLATE — edit this document and review all details before use.]\n\n[Add your information here.]";
  db.mockCases.unshift({
    id,
    userId: "usr_001",
    type: input.type,
    title: input.title,
    summary: input.summary,
    status: "drafted",
    authorityId: input.authorityId,
    createdAt: stamp,
    updatedAt: stamp,
  });
  db.mockDocuments.unshift({
    id: `doc_${++seq}`,
    caseId: id,
    title: input.documentTitle,
    kind: input.documentKind,
    createdAt: stamp,
    status: "draft",
    content: documentContent,
    plainLanguageContent: "[Plain-language summary for review.]",
    demoSourcePlaceholder: "Demo source placeholder — no legal citation has been verified.",
    citations: [{ label: "Official source reference not verified in this demo", verified: false }],
    versions: [
      {
        id: `ver_${++seq}`,
        savedAt: stamp,
        content: documentContent,
        note: "Initial draft",
      },
    ],
  });
  db.mockDeadlines.push({
    id: `dl_${++seq}`,
    caseId: id,
    label: "Suggested follow-up date",
    dueDate: due,
    demoOffsetDays: input.dueInDays,
    met: null,
    source: "simulated",
    sourceLabel: "Suggested demo date only — not a verified legal deadline",
  });
  appendEvent(id, "created", "Draft created — awaiting your review");
  if (input.evidenceFileName) {
    db.mockEvidence.unshift({
      id: `evidence_${++seq}`,
      caseId: id,
      label: "Selected locally — file not uploaded",
      fileName: input.evidenceFileName,
      uploadedAt: stamp,
    });
  }
  appendNotification({
    title: `Draft ready: ${input.title}`,
    body: "Review your case and sample document before deciding on next steps.",
    caseId: id,
    category: "draft",
  });
  return id;
}

export const authorities = () => db.mockAuthorities;
export const civicService = {
  nearby: (area: string, category: string) =>
    delay(
      db.mockCivicReports.filter(
        (r) =>
          area.trim().length > 2 &&
          r.area
            .toLowerCase()
            .split(" ")
            .some((w) => area.toLowerCase().includes(w)) &&
          r.category === category,
      ),
    ),
};
