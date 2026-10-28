import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2, Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CaseStatus } from "@/types";

const STATUS: Record<CaseStatus, { label: string; tone: string }> = {
  drafted: { label: "Drafted", tone: "bg-muted text-muted-foreground" },
  awaiting_review: { label: "Awaiting Review", tone: "bg-secondary text-secondary-foreground" },
  submitted: { label: "Submitted", tone: "bg-accent text-accent-foreground" },
  awaiting_response: { label: "Awaiting Response", tone: "bg-accent text-accent-foreground" },
  responded: { label: "Responded", tone: "bg-success/15 text-success" },
  deadline_breached: { label: "Deadline Breached", tone: "bg-destructive/10 text-destructive" },
  escalation_draft_ready: { label: "Escalation Draft Ready", tone: "bg-warning/20 text-warning-foreground" },
  escalated: { label: "Escalated", tone: "bg-warning/20 text-warning-foreground" },
  routed_legal_aid: { label: "Routed to Legal Aid", tone: "bg-primary/10 text-primary" },
  closed: { label: "Closed", tone: "bg-muted text-muted-foreground" },
};

export function StatusBadge({ status }: { status: CaseStatus }) {
  const s = STATUS[status];
  return <Badge variant="outline" className={cn("border-transparent font-medium", s.tone)}>{s.label}</Badge>;
}

export function LegalDisclaimer({ className }: { className?: string }) {
  return (
    <div className={cn("flex gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-warning-foreground", className)}>
      <Scale className="mt-0.5 h-4 w-4 shrink-0" />
      <p>NyaySetu provides procedural assistance and document preparation, not legal advice. Review all generated documents and verify applicable requirements before use.</p>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function SurfaceCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border bg-card p-5 shadow-soft", className)}>{children}</div>;
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{label}</div>;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed bg-card p-10 text-center">
      <Inbox className="h-8 w-8 text-muted-foreground" />
      <h3 className="mt-3 text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />{message}</div>;
}

export function Placeholder({ title, description }: { title: string; description: string }) {
  return (<><PageHeader title={title} description={description} /><EmptyState title="Coming soon" description="This module's interface is being built. Mock data is ready in the service layer." /></>);
}
