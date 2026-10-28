import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight, FileText, Pencil, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  LegalDisclaimer,
  LoadingState,
  PageHeader,
  StatusBadge,
  SurfaceCard,
} from "@/components/common";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  CASE_STATUS_LABEL,
  CASE_TYPE_LABEL,
  deadlineCountdownLabel,
  daysUntil,
  formatDate,
  isValidDeadline,
  nextRecommendedAction,
} from "@/lib/case-utils";
import { authorityService, caseService, documentService } from "@/services/mock-service";
import type { CaseStatus } from "@/types";

type ConfirmAction =
  | { kind: "transition"; status: CaseStatus }
  | { kind: "approve"; escalationId: string }
  | { kind: "related-rti" };

export const Route = createFileRoute("/_app/cases/$caseId")({
  loader: async ({ params }) => {
    const c = await caseService.get(params.caseId);
    if (!c) throw notFound();
    const [deadlines, events, documents, evidence, escalations, related] = await Promise.all([
      caseService.deadlines(c.id),
      caseService.events(c.id),
      documentService.list(),
      caseService.evidence(c.id),
      caseService.escalations(c.id),
      caseService.related(c),
    ]);
    return {
      c,
      deadlines,
      events,
      documents: documents.filter((d) => d.caseId === c.id),
      evidence,
      escalations,
      related,
    };
  },
  pendingComponent: () => <LoadingState label="Loading case details…" />,
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.c.title ?? "Case"} — NyaySetu` },
      { name: "description", content: "Case summary, timeline, documents and next steps." },
      { property: "og:title", content: "Case details — NyaySetu" },
      { property: "og:description", content: "Review case details and history." },
    ],
  }),
  component: CaseDetails,
});

function CaseDetails() {
  const { c, deadlines, events, documents, evidence, escalations, related } = Route.useLoaderData();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(c.title);
  const [summary, setSummary] = useState(c.summary);
  const [authorityId, setAuthorityId] = useState(c.authorityId);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const authority = authorityService.get(c.authorityId);
  const validDeadlines = deadlines.filter(
    (deadline) => deadline.source === "verified" && isValidDeadline(deadline),
  );
  const canCreateRelatedRti =
    c.type === "civic_fix" &&
    !["closed", "responded"].includes(c.status) &&
    !related.some((item) => item.type === "rti");

  useEffect(() => {
    setTitle(c.title);
    setSummary(c.summary);
    setAuthorityId(c.authorityId);
    setEditing(false);
    setError("");
  }, [c.id, c.title, c.summary, c.authorityId]);

  const refresh = async () => {
    await router.invalidate();
  };
  const saveCase = async () => {
    setError("");
    try {
      if (!title.trim() || !summary.trim()) throw new Error("Title and summary are required.");
      caseService.update(c.id, { title: title.trim(), summary: summary.trim(), authorityId });
      setEditing(false);
      toast.success(
        "Case details updated in this browser session. They are not synced to your account.",
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the case.");
    }
  };

  const performConfirmedAction = async () => {
    if (!confirm) return;
    setWorking(true);
    setError("");
    try {
      if (confirm.kind === "transition") caseService.transition(c.id, confirm.status);
      if (confirm.kind === "approve") caseService.approveEscalation(confirm.escalationId);
      if (confirm.kind === "related-rti") {
        const newId = caseService.createRelatedRti(c.id);
        toast.success("Related RTI draft created in this browser session.");
        setConfirm(null);
        await refresh();
        await router.navigate({ to: "/cases/$caseId", params: { caseId: newId } });
        setWorking(false);
        return;
      }
      toast.success("Case preview updated in this browser session.");
      setConfirm(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update this case.");
    } finally {
      setWorking(false);
    }
  };

  const confirmCopy = (() => {
    if (!confirm) return { title: "", body: "", action: "" };
    if (confirm.kind === "approve")
      return {
        title: "Approve this draft for review?",
        body: "This records a local review only. It does not submit, file, send or deliver the draft to anyone.",
        action: "Confirm review",
      };
    if (confirm.kind === "related-rti")
      return {
        title: "Create a related RTI case?",
        body: "This creates a linked draft preview for action-taken information. It is not saved to your account and will not be submitted.",
        action: "Create draft",
      };
    return {
      title: `Change status to ${CASE_STATUS_LABEL[confirm.status]}?`,
      body:
        confirm.status === "escalated"
          ? "This is a local status label only. It does not mean that anything has been filed or submitted."
          : "This updates the case preview in this browser session.",
      action: "Confirm status",
    };
  })();

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/cases">
          <ArrowLeft /> Back to My Cases
        </Link>
      </Button>
      <PageHeader
        title={c.title}
        description={`${c.id} · ${CASE_TYPE_LABEL[c.type]} · Created ${formatDate(c.createdAt)}`}
        actions={<StatusBadge status={c.status} />}
      />
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <SurfaceCard>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Case summary</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Current state and recommended next step
                </p>
              </div>
              {!editing && (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil /> Edit details
                </Button>
              )}
            </div>
            {editing ? (
              <div className="mt-4 space-y-3">
                <label className="block text-sm font-medium">
                  Issue title
                  <input
                    className="mt-1 block h-10 w-full rounded-md border bg-background px-3 font-normal"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                <label className="block text-sm font-medium">
                  Summary
                  <textarea
                    className="mt-1 block min-h-24 w-full rounded-md border bg-background p-3 font-normal"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                  />
                </label>
                <label className="block text-sm font-medium">
                  Selected authority
                  <select
                    className="mt-1 block h-10 w-full rounded-md border bg-background px-3 font-normal"
                    value={authorityId}
                    onChange={(e) => setAuthorityId(e.target.value)}
                  >
                    {authorityService.all().map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex gap-2">
                  <Button onClick={saveCase}>
                    <Save /> Save details
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditing(false);
                      setTitle(c.title);
                      setSummary(c.summary);
                      setAuthorityId(c.authorityId);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="mt-4 text-sm leading-6">{c.summary}</p>
                <div className="mt-4 rounded-lg bg-muted p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Recommended next action
                  </p>
                  <p className="mt-1 text-sm">{nextRecommendedAction(c)}</p>
                </div>
              </>
            )}
            <div className="mt-5 border-t pt-4">
              <label htmlFor="case-status" className="text-sm font-medium">
                Update case status
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                <select
                  id="case-status"
                  className="h-9 min-w-48 rounded-md border bg-background px-3 text-sm"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value)
                      setConfirm({ kind: "transition", status: e.target.value as CaseStatus });
                    e.target.value = "";
                  }}
                >
                  <option value="">Choose allowed next status…</option>
                  {caseService.transitions(c.status).map((next) => (
                    <option key={next} value={next}>
                      {CASE_STATUS_LABEL[next]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard>
            <h2 className="text-xl font-semibold">Case timeline</h2>
            <ol className="mt-5 space-y-5 border-l pl-5">
              {events.length ? (
                events.map((event) => (
                  <li key={event.id} className="relative">
                    <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full bg-teal ring-4 ring-card" />
                    <p className="text-sm font-medium">{event.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(event.at, event.at.includes("T"))}
                    </p>
                  </li>
                ))
              ) : (
                <li className="text-sm text-muted-foreground">
                  No timeline events have been recorded.
                </li>
              )}
            </ol>
          </SurfaceCard>
        </div>

        <div className="space-y-4">
          <SurfaceCard>
            <h2 className="font-semibold">Selected authority</h2>
            <p className="mt-3 font-medium">{authority?.name ?? "Authority not set"}</p>
            {authority && (
              <div className="mt-1 space-y-1 text-sm text-muted-foreground">
                <p>{authority.department}</p>
                <p>Jurisdiction: {authority.jurisdiction}</p>
                {authority.email && <p>{authority.email}</p>}
                {authority.address && <p>{authority.address}</p>}
              </div>
            )}
          </SurfaceCard>
          <SurfaceCard>
            <h2 className="font-semibold">Deadline details</h2>
            {validDeadlines.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No verified deadline is available. No countdown is shown.
              </p>
            ) : (
              validDeadlines.map((deadline) => {
                const days = daysUntil(deadline);
                return (
                  <div key={deadline.id} className="mt-3 rounded-lg bg-muted p-3">
                    <p className="text-sm font-medium">{deadline.label}</p>
                    <p className="mt-1 text-sm">Date: {formatDate(deadline.dueDate)}</p>
                    {days !== null && (
                      <p className="mt-1 text-sm font-semibold">{deadlineCountdownLabel(days)}</p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      Source/status: {deadline.sourceLabel}. Verified source
                      {deadline.met === false ? " · Marked missed" : ""}
                    </p>
                    <p className="mt-2 text-xs font-medium text-warning-foreground">
                      A verified source does not mean NyaySetu has independently determined a
                      legally valid filing deadline.
                    </p>
                  </div>
                );
              })
            )}
          </SurfaceCard>
          <SurfaceCard>
            <h2 className="font-semibold">Evidence references</h2>
            {evidence.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No evidence references are attached.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {evidence.map((item) => (
                  <li key={item.id} id={`evidence-${item.id}`} className="rounded-lg bg-muted p-3">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.fileName} · added {formatDate(item.uploadedAt)}
                    </p>
                    <p className="mt-1 text-xs text-warning-foreground">
                      This reference does not include the original attachment, which is not stored
                      here.
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SurfaceCard>
        </div>

        <SurfaceCard className="lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-semibold">Documents</h2>
            <Button variant="outline" size="sm" asChild>
              <Link to="/documents">
                Open library <ArrowUpRight />
              </Link>
            </Button>
          </div>
          {documents.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No documents for this case yet.</p>
          ) : (
            <ul className="mt-3 divide-y">
              {documents.map((doc) => (
                <li key={doc.id} className="flex items-center gap-3 py-3">
                  <FileText className="h-4 w-4 shrink-0 text-teal" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.kind.replaceAll("_", " ")} · {doc.status} · {formatDate(doc.createdAt)}
                    </p>
                  </div>
                  <Button variant="link" size="sm" asChild>
                    <Link to="/documents" search={{ documentId: doc.id }}>
                      Edit / view
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>

        <SurfaceCard>
          <h2 className="font-semibold">Escalation history</h2>
          {escalations.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No escalation drafts or approvals recorded.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {escalations.map((item) => {
                const escalationDocument =
                  documents.find((doc) => doc.id === item.documentId) ??
                  documents.find((doc) => doc.kind === "escalation");
                return (
                  <li key={item.id} className="rounded-lg bg-muted p-3">
                    <p className="text-sm font-medium">{item.level.replaceAll("_", " ")}</p>
                    <p className="text-xs text-muted-foreground">
                      Prepared {formatDate(item.createdAt)} ·{" "}
                      {item.status === "approved"
                        ? `Approved locally ${item.approvedAt ? formatDate(item.approvedAt) : ""}`
                        : "Awaiting review"}
                    </p>
                    {item.status === "draft" && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-warning-foreground">
                          Review the full draft before confirming this local review. It is not a
                          submission and is not synced to your account.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setExpandedDraftId(expandedDraftId === item.id ? null : item.id);
                            setReviewConfirmed(false);
                          }}
                        >
                          {expandedDraftId === item.id ? "Hide draft" : "Review draft"}
                        </Button>
                        {expandedDraftId === item.id && (
                          <div className="space-y-3">
                            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border bg-background p-3 text-xs leading-5">
                              {item.draftContent ??
                                "Draft content is not available. Open the linked document to review it."}
                            </pre>
                            {escalationDocument && (
                              <Link
                                to="/documents"
                                search={{ documentId: escalationDocument.id }}
                                className="text-sm font-medium text-primary hover:underline"
                              >
                                Open editable draft
                              </Link>
                            )}
                            <label className="flex items-start gap-2 text-xs">
                              <input
                                type="checkbox"
                                className="mt-0.5 accent-primary"
                                checked={reviewConfirmed}
                                onChange={(event) => setReviewConfirmed(event.target.checked)}
                              />
                              I reviewed this draft and understand that approval will not submit it.
                            </label>
                            <Button
                              size="sm"
                              disabled={!reviewConfirmed}
                              onClick={() => setConfirm({ kind: "approve", escalationId: item.id })}
                            >
                              <ShieldCheck /> Confirm local review
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {canCreateRelatedRti && (
            <div className="mt-4 border-t pt-4">
              <p className="text-xs text-muted-foreground">
                Create a linked draft preview for action-taken information. It will remain in this
                browser session.
              </p>
              <Button
                className="mt-2"
                variant="outline"
                size="sm"
                onClick={() => setConfirm({ kind: "related-rti" })}
              >
                Create related RTI draft
              </Button>
            </div>
          )}
        </SurfaceCard>

        {related.length > 0 && (
          <SurfaceCard className="lg:col-span-3">
            <h2 className="font-semibold">Related cases</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {related.map((item) => (
                <li key={item.id}>
                  <Link
                    to="/cases/$caseId"
                    params={{ caseId: item.id }}
                    className="block rounded-lg border p-3 hover:border-teal"
                  >
                    <p className="text-xs text-muted-foreground">
                      {item.parentCaseId ? `Child of ${item.parentCaseId}` : "Parent case"} ·{" "}
                      {CASE_TYPE_LABEL[item.type]}
                    </p>
                    <p className="mt-1 text-sm font-medium">{item.title}</p>
                    <div className="mt-2">
                      <StatusBadge status={item.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </SurfaceCard>
        )}
      </div>
      <LegalDisclaimer className="mt-6" />

      <AlertDialog
        open={!!confirm}
        onOpenChange={(open) => {
          if (!open && !working) setConfirm(null);
        }}
      >
        <AlertDialogContent className="max-h-[85dvh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmCopy.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmCopy.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={working}
              onClick={(event) => {
                event.preventDefault();
                void performConfirmedAction();
              }}
            >
              {working ? "Working…" : confirmCopy.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
