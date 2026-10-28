export type UserRole = "citizen" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  state: string;
  district: string;
  role: UserRole;
  createdAt: string;
}

export type CaseStatus =
  | "drafted"
  | "awaiting_review"
  | "submitted"
  | "awaiting_response"
  | "responded"
  | "deadline_breached"
  | "escalation_draft_ready"
  | "escalated"
  | "routed_legal_aid"
  | "closed";

export type CaseType = "rti" | "rights" | "civic_fix";

export interface Authority {
  id: string;
  name: string;
  department: string;
  jurisdiction: string;
  email?: string;
  address?: string;
}

export interface Document {
  id: string;
  caseId: string;
  title: string;
  kind: "application" | "first_appeal" | "complaint" | "escalation" | "reply";
  createdAt: string;
  status: "draft" | "final";
  content?: string;
  plainLanguageContent?: string;
  formalContent?: string;
  citations?: DocumentCitation[];
  versions?: DocumentVersion[];
  sourcePlaceholder?: string;
}

export interface DocumentCitation {
  label: string;
  url?: string;
  verified: boolean;
}

export interface DocumentVersion {
  id: string;
  savedAt: string;
  content: string;
  note: string;
  field?: "content" | "plainLanguageContent" | "formalContent";
}

export interface Evidence {
  id: string;
  caseId: string;
  label: string;
  fileName: string;
  uploadedAt: string;
}

export interface Deadline {
  id: string;
  caseId: string;
  label: string;
  dueDate: string;
  suggestedOffsetDays: number;
  met: boolean | null;
  source: "simulated" | "verified";
  sourceLabel: string;
}

export interface Escalation {
  id: string;
  caseId: string;
  level:
    | "first_appeal"
    | "second_appeal"
    | "grievance"
    | "legal_aid"
    | "representation"
    | "action_taken_request"
    | "next_step";
  authorityId: string;
  createdAt: string;
  status: "draft" | "approved";
  draftContent?: string;
  documentId?: string;
  approvedAt?: string;
}

export interface CaseEvent {
  id: string;
  caseId: string;
  type:
    | "created"
    | "submitted"
    | "response"
    | "deadline"
    | "escalation"
    | "note"
    | "status_change"
    | "document";
  title: string;
  at: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  at: string;
  read: boolean;
  caseId?: string;
  category?: "deadline" | "draft" | "response" | "escalation";
}

export interface MLPrediction {
  caseId: string;
  category: string;
  confidence: number;
  suggestedAuthorityId: string;
  model: string;
}

export interface Case {
  id: string;
  userId: string;
  type: CaseType;
  title: string;
  summary: string;
  status: CaseStatus;
  authorityId: string;
  createdAt: string;
  updatedAt: string;
  parentCaseId?: string;
}
