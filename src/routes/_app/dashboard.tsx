import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Briefcase,
  CalendarClock,
  Clock,
  FileText,
} from "lucide-react";
import {
  EmptyState,
  LegalDisclaimer,
  LoadingState,
  PageHeader,
  StatusBadge,
  SurfaceCard,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { daysUntil, formatDate, isValidDeadline } from "@/lib/case-utils";
import { caseService, documentService, notificationService } from "@/services/mock-service";
import { MODULES } from "@/data/modules";
import type { Case } from "@/types";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — NyaySetu" },
      { name: "description", content: "Your cases, deadlines and escalations at a glance." },
      { property: "og:title", content: "Dashboard — NyaySetu" },
      { property: "og:description", content: "Your cases, deadlines and escalations at a glance." },
    ],
  }),
  loader: async () => {
    const [cases, deadlines, events, docs, notes] = await Promise.all([
      caseService.list(),
      caseService.allDeadlines(),
      caseService.allEvents(),
      documentService.list(),
      notificationService.list(),
    ]);
    return { cases, deadlines, events, docs, notes };
  },
  pendingComponent: () => <LoadingState label="Loading your dashboard…" />,
  component: Dashboard,
});

const FILTERS: Record<string, (c: Case) => boolean> = {
  All: () => true,
  Active: (c) => c.status !== "closed",
  "Deadline Breached": (c) => c.status === "deadline_breached",
  Closed: (c) => c.status === "closed",
};

function Dashboard() {
  const { cases, deadlines, events, docs, notes } = Route.useLoaderData();
  const [filter, setFilter] = useState("All");
  const byId = (id: string) => cases.find((c) => c.id === id);
  const upcoming = deadlines
    .filter(
      (d) =>
        d.source === "verified" &&
        isValidDeadline(d) &&
        d.met !== false &&
        (daysUntil(d) ?? -1) >= 0 &&
        byId(d.caseId)?.status !== "closed",
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const review = cases.filter(
    (c) => c.status === "deadline_breached" || c.status === "escalation_draft_ready",
  );
  const stats = [
    { label: "Active Cases", value: cases.filter(FILTERS["Active"]!).length, icon: Briefcase },
    {
      label: "Awaiting Response",
      value: cases.filter((c) => c.status === "awaiting_response").length,
      icon: Clock,
    },
    { label: "Upcoming Deadlines", value: upcoming.length, icon: CalendarClock },
    { label: "Escalations to Review", value: review.length, icon: AlertTriangle },
  ];
  const shown = cases.filter(FILTERS[filter]!);

  return (
    <>
      <PageHeader
        title="Your dashboard"
        description="Review local case previews and keep track of your next steps. Preview changes are not synced to your account."
        actions={
          <Button asChild>
            <Link to="/new-case">Create Case</Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {MODULES.map(({ to, icon: Icon, t, d }) => (
          <Link key={to} to={to}>
            <SurfaceCard className="h-full transition-colors hover:border-teal">
              <Icon className="h-5 w-5 text-primary" />
              <p className="mt-3 font-semibold">{t}</p>
              <p className="mt-1 text-xs text-muted-foreground">{d}</p>
            </SurfaceCard>
          </Link>
        ))}
      </div>
      <Link
        to="/new-case"
        className="mt-4 flex items-center justify-between rounded-xl border border-dashed bg-card p-5 text-muted-foreground hover:border-teal"
      >
        <span>What problem are you facing? Describe it here…</span>
        <ArrowRight className="h-4 w-4" />
      </Link>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <SurfaceCard key={label}>
            <Icon className="h-5 w-5 text-teal" />
            <p className="mt-3 text-3xl font-semibold">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </SurfaceCard>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <SurfaceCard className="p-0 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4">
            <h2 className="font-semibold">Cases</h2>
            <div className="flex flex-wrap gap-1">
              {Object.keys(FILTERS).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium",
                    filter === f
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          {shown.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title={cases.length ? "No cases here" : "No cases yet"}
                description={
                  cases.length
                    ? "No cases match this view."
                    : "Create a case to see its status and next action here."
                }
                action={
                  !cases.length ? (
                    <Button asChild size="sm">
                      <Link to="/new-case">Create a case</Link>
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <ul className="divide-y">
              {shown.map((c) => (
                <li key={c.id}>
                  <Link
                    to="/cases/$caseId"
                    params={{ caseId: c.id }}
                    className="flex flex-col gap-2 px-5 py-4 hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{c.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.type.replace("_", " ").toUpperCase()} · updated {formatDate(c.updatedAt)}
                      </p>
                    </div>
                    <StatusBadge status={c.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>

        <SurfaceCard>
          <h2 className="font-semibold">Upcoming deadlines</h2>
          {upcoming.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No upcoming verified dates.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {upcoming.map((d) => (
                <li key={d.id}>
                  <Link
                    to="/cases/$caseId"
                    params={{ caseId: d.caseId }}
                    className="block rounded-lg bg-muted p-3 hover:bg-secondary"
                  >
                    <p className="text-sm font-medium">{d.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {byId(d.caseId)?.title} · due {formatDate(d.dueDate)} · date not legally
                      verified
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>

        <SurfaceCard>
          <h2 className="font-semibold">Recommended next actions</h2>
          {review.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No escalation drafts need review.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {review.map((c) => (
                <li key={c.id}>
                  <Link
                    to="/cases/$caseId"
                    params={{ caseId: c.id }}
                    className="flex items-start gap-2 text-sm hover:text-primary"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />
                    Review escalation for “{c.title}”
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <h2 className="mt-6 font-semibold">Notifications</h2>
          {notes.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No notifications.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {notes.slice(0, 5).map((n) => (
                <li key={n.id}>
                  <Link to="/notifications" className="flex gap-2 text-sm">
                    <Bell
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        n.read ? "text-muted-foreground" : "text-teal",
                      )}
                    />
                    {n.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>

        <SurfaceCard>
          <h2 className="font-semibold">Recent activity</h2>
          {events.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No recent activity.</p>
          ) : (
            <ol className="mt-4 space-y-3 border-l pl-4">
              {events.slice(0, 6).map((e) => (
                <li key={e.id}>
                  <Link
                    to="/cases/$caseId"
                    params={{ caseId: e.caseId }}
                    className="text-sm font-medium hover:text-primary"
                  >
                    {e.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {byId(e.caseId)?.title} · {formatDate(e.at, e.at.includes("T"))}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </SurfaceCard>

        <SurfaceCard>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Recent documents</h2>
            <Link to="/documents" className="text-xs text-primary">
              View all
            </Link>
          </div>
          {docs.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No documents yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {docs.slice(0, 5).map((d) => (
                <li key={d.id}>
                  <Link
                    to="/documents"
                    search={{ documentId: d.id }}
                    className="flex gap-2 text-sm hover:text-primary"
                  >
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
                    <span>
                      {d.title}
                      <span className="block text-xs text-muted-foreground">
                        {d.status} · {formatDate(d.createdAt)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>
      </div>
      <LegalDisclaimer className="mt-6" />
    </>
  );
}
