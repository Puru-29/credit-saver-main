import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import {
  EmptyState,
  LoadingState,
  PageHeader,
  StatusBadge,
  SurfaceCard,
} from "@/components/common";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  CASE_TYPE_LABEL,
  deadlineCountdownLabel,
  daysUntil,
  formatDemoDate,
  isValidDeadline,
  nextRecommendedAction,
} from "@/lib/case-utils";
import { authorityService, caseService } from "@/services/mock-service";
import type { CaseStatus, CaseType } from "@/types";

export const Route = createFileRoute("/_app/cases/")({
  head: () => ({
    meta: [
      { title: "My Cases — NyaySetu" },
      { name: "description", content: "Search and manage your demo cases." },
      { property: "og:title", content: "My Cases — NyaySetu" },
      { property: "og:description", content: "Search and manage your demo cases." },
    ],
  }),
  loader: async () => {
    const [cases, deadlines] = await Promise.all([caseService.list(), caseService.allDeadlines()]);
    return { cases, deadlines };
  },
  pendingComponent: () => <LoadingState label="Loading your cases…" />,
  component: CasesPage,
});

type DeadlineFilter = "all" | "has_date" | "upcoming" | "past" | "none";
type SortOption = "updated_desc" | "created_desc" | "created_asc" | "deadline_asc" | "title_asc";

function CasesPage() {
  const { cases, deadlines } = Route.useLoaderData();
  const [query, setQuery] = useState("");
  const [module, setModule] = useState<CaseType | "all">("all");
  const [status, setStatus] = useState<CaseStatus | "all">("all");
  const [deadlineCondition, setDeadlineCondition] = useState<DeadlineFilter>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sort, setSort] = useState<SortOption>("updated_desc");

  const withDeadline = cases.map((c) => ({
    c,
    deadline: deadlines
      .filter((d) => d.caseId === c.id && isValidDeadline(d))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0],
  }));
  const filtered = withDeadline
    .filter(({ c, deadline }) => {
      const authority = authorityService.get(c.authorityId)?.name ?? "";
      const text =
        `${c.id} ${c.title} ${c.summary} ${authority} ${CASE_TYPE_LABEL[c.type]}`.toLowerCase();
      const days = deadline ? daysUntil(deadline) : null;
      return (
        (!query || text.includes(query.toLowerCase())) &&
        (module === "all" || c.type === module) &&
        (status === "all" || c.status === status) &&
        (!fromDate || c.createdAt >= fromDate) &&
        (!toDate || c.createdAt <= toDate) &&
        (deadlineCondition === "all" ||
          (deadlineCondition === "none" && !deadline) ||
          (deadlineCondition === "has_date" && !!deadline) ||
          (deadlineCondition === "upcoming" && days !== null && days >= 0) ||
          (deadlineCondition === "past" && days !== null && days < 0))
      );
    })
    .sort((a, b) => {
      if (sort === "created_asc") return a.c.createdAt.localeCompare(b.c.createdAt);
      if (sort === "created_desc") return b.c.createdAt.localeCompare(a.c.createdAt);
      if (sort === "deadline_asc")
        return (a.deadline?.dueDate ?? "9999").localeCompare(b.deadline?.dueDate ?? "9999");
      if (sort === "title_asc") return a.c.title.localeCompare(b.c.title);
      return b.c.updatedAt.localeCompare(a.c.updatedAt);
    });

  return (
    <>
      <PageHeader
        title="My Cases"
        description="Search, filter and review your cases. Dates in this demo are not filing advice."
        actions={
          <Button asChild>
            <Link to="/new-case">Create case</Link>
          </Button>
        }
      />
      <SurfaceCard className="mb-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="relative sm:col-span-2">
            <span className="sr-only">Search cases</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search ID, issue or authority"
              className="pl-9"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Module
            <select
              className="mt-1 block h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground"
              value={module}
              onChange={(e) => setModule(e.target.value as CaseType | "all")}
            >
              <option value="all">All modules</option>
              {Object.entries(CASE_TYPE_LABEL).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Status
            <select
              className="mt-1 block h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground"
              value={status}
              onChange={(e) => setStatus(e.target.value as CaseStatus | "all")}
            >
              <option value="all">All statuses</option>
              {Object.entries(awaitlessStatusOptions()).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Deadline condition
            <select
              className="mt-1 block h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground"
              value={deadlineCondition}
              onChange={(e) => setDeadlineCondition(e.target.value as DeadlineFilter)}
            >
              <option value="all">Any deadline</option>
              <option value="upcoming">Upcoming or today</option>
              <option value="past">Past demo date</option>
              <option value="has_date">Has a demo date</option>
              <option value="none">No valid date</option>
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Created from
            <input
              type="date"
              className="mt-1 block h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Created through
            <input
              type="date"
              className="mt-1 block h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Sort by
            <select
              className="mt-1 block h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
            >
              <option value="updated_desc">Recently updated</option>
              <option value="created_desc">Newest created</option>
              <option value="created_asc">Oldest created</option>
              <option value="deadline_asc">Nearest demo date</option>
              <option value="title_asc">Issue name</option>
            </select>
          </label>
        </div>
      </SurfaceCard>

      <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
        Showing {filtered.length} of {cases.length} cases
      </p>
      {filtered.length === 0 ? (
        <EmptyState
          title={cases.length === 0 ? "No cases yet" : "No matching cases"}
          description={
            cases.length === 0
              ? "Create a demo case to see its status, timeline and documents here."
              : "Try changing the search or filters to find a case."
          }
          action={
            cases.length === 0 ? (
              <Button asChild>
                <Link to="/new-case">Create a case</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(({ c, deadline }) => {
            const authority = authorityService.get(c.authorityId);
            const days = deadline ? daysUntil(deadline) : null;
            return (
              <Link key={c.id} to="/cases/$caseId" params={{ caseId: c.id }} className="block">
                <SurfaceCard className="transition-colors hover:border-teal">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{c.id}</span>
                        <StatusBadge status={c.status} />
                      </div>
                      <h2 className="mt-2 text-lg font-semibold">{c.title}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{c.summary}</p>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>{CASE_TYPE_LABEL[c.type]}</span>
                        <span>{authority?.name ?? "Authority not set"}</span>
                        <span>Created {formatDemoDate(c.createdAt)}</span>
                      </div>
                    </div>
                    <div className="space-y-2 lg:max-w-xs lg:text-right">
                      {deadline && days !== null ? (
                        <div className="text-sm">
                          <p className="font-medium">
                            {deadline.label} · {formatDemoDate(deadline.dueDate)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {deadlineCountdownLabel(days)} · {deadline.sourceLabel}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No valid demo deadline</p>
                      )}
                      <p className="text-sm">
                        <span className="font-medium">Next action: </span>
                        <span className="text-muted-foreground">{nextRecommendedAction(c)}</span>
                      </p>
                    </div>
                  </div>
                </SurfaceCard>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

function awaitlessStatusOptions() {
  return {
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
  } satisfies Record<CaseStatus, string>;
}
