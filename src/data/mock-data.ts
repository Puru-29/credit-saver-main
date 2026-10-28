import type {
  Authority,
  Case,
  CaseEvent,
  Deadline,
  Document,
  Escalation,
  Evidence,
  User,
} from "@/types";

// Fictional seed data only. Single source of truth for the demo.
export const mockUsers: User[] = [
  {
    id: "usr_001",
    name: "Ananya Rao",
    email: "ananya@example.in",
    phone: "+91 98000 00001",
    state: "Karnataka",
    district: "Bengaluru Urban",
    role: "citizen",
    createdAt: "2026-06-02",
  },
  {
    id: "usr_900",
    name: "Admin Desk",
    email: "admin@nyaysetu.example",
    state: "Delhi",
    district: "New Delhi",
    role: "admin",
    createdAt: "2026-01-10",
  },
];

export const mockAuthorities: Authority[] = [
  {
    id: "auth_bbmp",
    name: "Public Information Officer, BBMP",
    department: "Urban Development",
    jurisdiction: "Bengaluru",
    email: "pio@bbmp.example",
  },
  {
    id: "auth_bescom",
    name: "Assistant Executive Engineer, BESCOM",
    department: "Energy",
    jurisdiction: "Bengaluru South",
  },
  {
    id: "auth_bbmp_roads",
    name: "Executive Engineer, BBMP Road Infrastructure",
    department: "Roads",
    jurisdiction: "Bengaluru — all zones",
  },
  {
    id: "auth_bwssb",
    name: "Assistant Engineer, BWSSB",
    department: "Water & Drainage",
    jurisdiction: "Bengaluru",
  },
  {
    id: "auth_bbmp_swm",
    name: "Solid Waste Management Cell, BBMP",
    department: "Sanitation",
    jurisdiction: "Bengaluru",
  },
  {
    id: "auth_dlsa",
    name: "District Legal Services Authority",
    department: "Law & Justice",
    jurisdiction: "Bengaluru Urban",
  },
];

export const mockCases: Case[] = [
  {
    id: "case_101",
    userId: "usr_001",
    type: "rti",
    title: "Road repair expenditure, Ward 150",
    summary: "Information on sanctioned and spent amounts for road repairs in 2025–26.",
    status: "awaiting_response",
    authorityId: "auth_bbmp",
    createdAt: "2026-09-20",
    updatedAt: "2026-09-22",
  },
  {
    id: "case_102",
    userId: "usr_001",
    type: "civic_fix",
    title: "Streetlight outage on 4th Cross",
    summary: "Six streetlights non-functional for three weeks.",
    status: "deadline_breached",
    authorityId: "auth_bescom",
    createdAt: "2026-09-01",
    updatedAt: "2026-10-05",
  },
  {
    id: "case_103",
    userId: "usr_001",
    type: "rights",
    title: "Wage withholding by employer",
    summary: "Two months of wages unpaid; seeking legal aid route.",
    status: "routed_legal_aid",
    authorityId: "auth_dlsa",
    createdAt: "2026-08-12",
    updatedAt: "2026-09-30",
  },
  {
    id: "case_105",
    userId: "usr_001",
    type: "civic_fix",
    title: "Garbage not collected, HSR Sector 2",
    summary: "Waste pickup missed for 10 days.",
    status: "escalation_draft_ready",
    authorityId: "auth_bbmp",
    createdAt: "2026-09-10",
    updatedAt: "2026-10-18",
  },
  {
    id: "case_106",
    userId: "usr_001",
    type: "rights",
    title: "Security deposit not returned",
    summary: "Landlord withholding deposit after vacating.",
    status: "awaiting_review",
    authorityId: "auth_dlsa",
    createdAt: "2026-10-15",
    updatedAt: "2026-10-20",
  },
  {
    id: "case_107",
    userId: "usr_001",
    type: "rti",
    title: "Park maintenance contract details",
    summary: "Copy of contract and payments for Agara Lake park.",
    status: "closed",
    authorityId: "auth_bbmp",
    createdAt: "2026-06-05",
    updatedAt: "2026-07-08",
  },
  {
    id: "case_104",
    userId: "usr_001",
    type: "rti",
    title: "Ration card application status",
    summary: "Status of application pending since May.",
    status: "drafted",
    authorityId: "auth_bbmp",
    createdAt: "2026-10-25",
    updatedAt: "2026-10-25",
  },
];

export const mockDeadlines: Deadline[] = [
  {
    id: "dl_101",
    caseId: "case_101",
    label: "Demo reply-window marker",
    dueDate: "2026-10-22",
    demoOffsetDays: 30,
    met: null,
    source: "simulated",
    sourceLabel: "Simulated demo date — not a verified legal deadline",
  },
  {
    id: "dl_105",
    caseId: "case_105",
    label: "Suggested demo review date",
    dueDate: "2026-11-02",
    demoOffsetDays: 15,
    met: null,
    source: "simulated",
    sourceLabel: "Suggested date for this prototype only",
  },
  {
    id: "dl_106",
    caseId: "case_106",
    label: "Suggested follow-up date",
    dueDate: "2026-11-10",
    demoOffsetDays: 21,
    met: null,
    source: "simulated",
    sourceLabel: "Suggested date for this prototype only",
  },
  {
    id: "dl_102",
    caseId: "case_102",
    label: "Demo grievance-window marker",
    dueDate: "2026-10-01",
    demoOffsetDays: 30,
    met: false,
    source: "simulated",
    sourceLabel: "Simulated demo date — not a verified legal deadline",
  },
];

export const mockDocuments: Document[] = [
  {
    id: "doc_101",
    caseId: "case_101",
    title: "RTI application draft",
    kind: "application",
    createdAt: "2026-09-20",
    status: "final",
    content:
      "Subject: Road repair expenditure, Ward 150\n\nPlease share copies of records showing the amounts sanctioned and spent on road repairs in Ward 150 during 2025–26.\n\nApplicant: [Add your name and contact details]\nDate: [Add date]\n\n[DEMO TEMPLATE — review and verify all requirements before use.]",
    plainLanguageContent:
      "Please share the records showing how much money was approved and spent on road repairs in Ward 150 during 2025–26.",
    citations: [{ label: "Official source reference not verified in this demo", verified: false }],
    demoSourcePlaceholder: "Demo source placeholder — no legal citation has been verified.",
    versions: [
      {
        id: "ver_101_1",
        savedAt: "2026-09-20",
        content: "Initial sample RTI request prepared for review.",
        note: "Initial draft",
      },
    ],
  },
  {
    id: "doc_102",
    caseId: "case_102",
    title: "Escalation letter draft",
    kind: "escalation",
    createdAt: "2026-10-05",
    status: "draft",
    content:
      "Subject: Request to review unresolved streetlight report\n\nI reported non-functioning streetlights on 4th Cross. The issue remains unresolved according to my records.\n\nPlease review the report and share any action taken or the next steps.\n\n[DEMO DRAFT — not submitted. Add accurate dates and evidence before use.]",
    plainLanguageContent:
      "The streetlights on 4th Cross are still not working. Please check the earlier report and let me know what action has been taken.",
    demoSourcePlaceholder: "Demo source placeholder — no legal citation has been verified.",
    versions: [
      {
        id: "ver_102_1",
        savedAt: "2026-10-05",
        content: "Initial sample escalation draft.",
        note: "Initial draft",
      },
    ],
  },
  {
    id: "doc_104",
    caseId: "case_104",
    title: "RTI application draft",
    kind: "application",
    createdAt: "2026-10-25",
    status: "draft",
    content:
      "Subject: Status of ration card application\n\nPlease share the current status of my ration card application submitted in May, along with a copy of any recorded action or outstanding requirements.\n\nApplicant: [Add your name and contact details]\nDate: [Add date]\n\n[DEMO TEMPLATE — review and verify all requirements before use.]",
    formalContent:
      "To the concerned public office,\n\nSubject: Request for application status information\n\nPlease provide the current status of my ration card application submitted in May and copies of records showing action taken or any outstanding requirements.\n\nApplicant: [Add your name and contact details]\nDate: [Add date]\n\n[DEMO TEMPLATE — review and verify all requirements before use.]",
    plainLanguageContent:
      "Please tell me what is happening with my ration card application submitted in May and whether you need anything else from me.",
    citations: [{ label: "Official source reference not verified in this demo", verified: false }],
    demoSourcePlaceholder: "Demo source placeholder — no legal citation has been verified.",
    versions: [
      {
        id: "ver_104_1",
        savedAt: "2026-10-25",
        content: "Initial sample application draft.",
        note: "Initial draft",
      },
    ],
  },
  {
    id: "doc_105",
    caseId: "case_105",
    title: "Action-taken request draft",
    kind: "escalation",
    createdAt: "2026-10-18",
    status: "draft",
    content:
      "Subject: Request for an update on missed waste collection\n\nPlease review my earlier report about missed waste collection in HSR Sector 2 and share the current status and any action taken.\n\n[DEMO DRAFT — review facts and authority details before use. Not submitted.]",
    plainLanguageContent:
      "Please let me know whether action has been taken on the missed waste collection report in HSR Sector 2.",
    demoSourcePlaceholder:
      "Demo source placeholder — no official process or legal citation has been verified.",
    citations: [{ label: "No verified source attached to this sample", verified: false }],
    versions: [
      {
        id: "ver_105_1",
        savedAt: "2026-10-18",
        content: "Initial action-taken request sample draft.",
        note: "Initial draft",
      },
    ],
  },
];

export const mockEvidence: Evidence[] = [
  {
    id: "ev_102",
    caseId: "case_102",
    label: "Photo of dark street",
    fileName: "street-4th-cross.jpg",
    uploadedAt: "2026-09-01",
  },
];

export const mockEscalations: Escalation[] = [
  {
    id: "esc_102",
    caseId: "case_102",
    level: "grievance",
    authorityId: "auth_bescom",
    createdAt: "2026-10-05",
    status: "draft",
    documentId: "doc_102",
    draftContent:
      "Sample request to review the unresolved streetlight report and share action taken. Demo draft only — verify details before use.",
  },
  {
    id: "esc_105",
    caseId: "case_105",
    level: "representation",
    authorityId: "auth_bbmp_swm",
    createdAt: "2026-10-18",
    status: "draft",
    documentId: "doc_105",
    draftContent:
      "Sample request to review the missed waste collection report and share any action taken. Demo draft only — confirm the responsible office and details before use.",
  },
];

export const mockEvents: CaseEvent[] = [
  { id: "ev_1", caseId: "case_101", type: "created", title: "Case created", at: "2026-09-20" },
  {
    id: "ev_2",
    caseId: "case_101",
    type: "submitted",
    title: "Marked as submitted by you",
    at: "2026-09-22",
  },
  { id: "ev_3", caseId: "case_102", type: "created", title: "Case created", at: "2026-09-01" },
  {
    id: "ev_4",
    caseId: "case_102",
    type: "deadline",
    title: "Deadline breached",
    at: "2026-10-01",
  },
  {
    id: "ev_6",
    caseId: "case_105",
    type: "escalation",
    title: "Escalation draft ready for review",
    at: "2026-10-18",
  },
  {
    id: "ev_7",
    caseId: "case_106",
    type: "note",
    title: "Draft notice prepared",
    at: "2026-10-20",
  },
  { id: "ev_8", caseId: "case_104", type: "created", title: "Case drafted", at: "2026-10-25" },
  {
    id: "ev_5",
    caseId: "case_102",
    type: "escalation",
    title: "Escalation draft prepared",
    at: "2026-10-05",
  },
];

export const mockNotifications: import("@/types").Notification[] = [
  {
    id: "ntf_1",
    title: "Deadline breached: Streetlight outage",
    body: "Review the escalation draft.",
    at: "2026-10-05",
    read: false,
    caseId: "case_102",
    category: "escalation",
  },
  {
    id: "ntf_2",
    title: "RTI reply-window marker passed",
    body: "The simulated date for the road repair RTI passed on 22 Oct. This is not a verified filing deadline.",
    at: "2026-10-20",
    read: true,
    caseId: "case_101",
    category: "deadline",
  },
];

// Fictional nearby reports for the duplicate-check prototype.
export const mockCivicReports = [
  {
    id: "rep_01",
    category: "pothole",
    area: "HSR Layout",
    title: "Deep pothole near 27th Main signal",
    reportedOn: "2026-10-12",
  },
  {
    id: "rep_02",
    category: "streetlight",
    area: "Jayanagar",
    title: "Streetlights off on 4th Cross",
    reportedOn: "2026-09-01",
  },
  {
    id: "rep_03",
    category: "waste",
    area: "HSR Layout",
    title: "Garbage pile at Sector 2 corner",
    reportedOn: "2026-09-10",
  },
  {
    id: "rep_04",
    category: "drain",
    area: "Koramangala",
    title: "Open drain overflowing on 80 Ft Road",
    reportedOn: "2026-10-20",
  },
];
