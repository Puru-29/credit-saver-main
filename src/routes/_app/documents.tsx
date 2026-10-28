import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { FileText, Printer, Save, Search } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, LoadingState, PageHeader, SurfaceCard } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CASE_TYPE_LABEL, formatDemoDate } from "@/lib/case-utils";
import { caseService, documentService } from "@/services/mock-service";
import type { CaseType, Document } from "@/types";

type ContentField = "content" | "plainLanguageContent" | "formalContent";

export const Route = createFileRoute("/_app/documents")({
  validateSearch: (search: Record<string, unknown>): { documentId?: string } => ({
    documentId: typeof search.documentId === "string" ? search.documentId : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Documents — NyaySetu" },
      { name: "description", content: "Search and edit sample case documents." },
      { property: "og:title", content: "Documents — NyaySetu" },
      { property: "og:description", content: "Search and edit your demo documents." },
    ],
  }),
  loader: async () => {
    const [documents, cases] = await Promise.all([documentService.list(), caseService.list()]);
    return { documents, cases };
  },
  pendingComponent: () => <LoadingState label="Loading documents…" />,
  component: DocumentsPage,
});

function documentFieldContent(doc: Document, field: ContentField): string {
  if (field === "plainLanguageContent") return doc.plainLanguageContent ?? "";
  if (field === "formalContent") return doc.formalContent ?? "";
  return doc.content ?? "";
}

function DocumentsPage() {
  const { documents, cases } = Route.useLoaderData();
  const search = Route.useSearch();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [caseFilter, setCaseFilter] = useState("all");
  const [moduleFilter, setModuleFilter] = useState<CaseType | "all">("all");
  const [kindFilter, setKindFilter] = useState<Document["kind"] | "all">("all");
  const [selectedId, setSelectedId] = useState("");
  const [field, setField] = useState<ContentField>("content");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const caseById = useMemo(() => new Map(cases.map((c) => [c.id, c])), [cases]);
  const selectedDoc = documents.find((doc) => doc.id === selectedId);

  useEffect(() => {
    const requested = documents.find((doc) => doc.id === search.documentId);
    const initial = requested ?? documents[0];
    setSelectedId(initial?.id ?? "");
    setField("content");
    setContent(initial?.content ?? "");
  }, [documents, search.documentId]);

  const filtered = documents.filter((doc) => {
    const c = caseById.get(doc.caseId);
    const text = `${doc.title} ${doc.kind} ${doc.caseId} ${c?.title ?? ""}`.toLowerCase();
    return (
      (!query || text.includes(query.toLowerCase())) &&
      (caseFilter === "all" || doc.caseId === caseFilter) &&
      (moduleFilter === "all" || c?.type === moduleFilter) &&
      (kindFilter === "all" || doc.kind === kindFilter)
    );
  });

  const selectDocument = (doc: Document) => {
    setError("");
    void router.navigate({ to: "/documents", search: { documentId: doc.id }, replace: true });
  };
  const selectField = (next: ContentField) => {
    if (!selectedDoc) return;
    setField(next);
    setContent(documentFieldContent(selectedDoc, next));
  };
  const saveDraft = async () => {
    if (!selectedDoc) return;
    setSaving(true);
    setError("");
    try {
      documentService.save(selectedDoc.id, content, field);
      toast.success("Draft saved in this demo session.");
      await router.invalidate();
      const updated = await documentService.get(selectedDoc.id);
      if (updated) setContent(documentFieldContent(updated, field));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this draft.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Documents"
        description="Search, edit and review sample documents. Nothing is submitted from this library."
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.7fr)]">
        <div className="print:hidden">
          <SurfaceCard className="mb-4">
            <label className="relative block">
              <span className="sr-only">Search documents</span>
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title, case or type"
                className="pl-9"
              />
            </label>
            <div className="mt-3 grid gap-2">
              <label className="text-xs text-muted-foreground">
                Case
                <select
                  className="mt-1 block h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground"
                  value={caseFilter}
                  onChange={(e) => setCaseFilter(e.target.value)}
                >
                  <option value="all">All cases</option>
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id} · {c.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted-foreground">
                Module
                <select
                  className="mt-1 block h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground"
                  value={moduleFilter}
                  onChange={(e) => setModuleFilter(e.target.value as CaseType | "all")}
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
                Document type
                <select
                  className="mt-1 block h-9 w-full rounded-md border bg-background px-2 text-sm capitalize text-foreground"
                  value={kindFilter}
                  onChange={(e) => setKindFilter(e.target.value as Document["kind"] | "all")}
                >
                  <option value="all">All types</option>
                  {["application", "first_appeal", "complaint", "escalation", "reply"].map(
                    (kind) => (
                      <option key={kind} value={kind}>
                        {kind.replaceAll("_", " ")}
                      </option>
                    ),
                  )}
                </select>
              </label>
            </div>
          </SurfaceCard>
          <SurfaceCard className="p-0">
            {filtered.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title={documents.length ? "No matching documents" : "No documents yet"}
                  description={
                    documents.length
                      ? "Try changing the search or filters."
                      : "Create a demo case to prepare its first sample document."
                  }
                />
              </div>
            ) : (
              <ul className="divide-y">
                {filtered.map((doc) => {
                  const c = caseById.get(doc.caseId);
                  return (
                    <li key={doc.id}>
                      <button
                        type="button"
                        onClick={() => selectDocument(doc)}
                        aria-current={selectedId === doc.id ? "true" : undefined}
                        className={`w-full px-4 py-4 text-left transition-colors hover:bg-muted/70 ${selectedId === doc.id ? "bg-accent" : ""}`}
                      >
                        <span className="flex items-start gap-3">
                          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">{doc.title}</span>
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {doc.caseId} · {c?.type ? CASE_TYPE_LABEL[c.type] : "Unknown module"}{" "}
                              · {formatDemoDate(doc.createdAt)}
                            </span>
                            <Badge variant="secondary" className="mt-2">
                              {doc.status}
                            </Badge>
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </SurfaceCard>
        </div>

        <SurfaceCard>
          {!selectedDoc ? (
            <EmptyState
              title="Select a document"
              description="Choose a document from your library to open the editor."
            />
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{selectedDoc.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedDoc.caseId} ·{" "}
                    {caseById.get(selectedDoc.caseId)?.title ?? "Case details unavailable"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 print:hidden">
                  <Button variant="outline" size="sm" onClick={() => window.print()}>
                    <Printer /> Print / Save as PDF
                  </Button>
                  <Button size="sm" onClick={() => void saveDraft()} disabled={saving}>
                    <Save /> {saving ? "Saving…" : "Save Draft"}
                  </Button>
                </div>
              </div>
              <div
                className="mt-4 flex flex-wrap gap-2 border-b pb-3"
                role="tablist"
                aria-label="Document version"
              >
                <Button
                  type="button"
                  role="tab"
                  aria-selected={field === "content"}
                  size="sm"
                  variant={field === "content" ? "default" : "outline"}
                  onClick={() => selectField("content")}
                >
                  Document
                </Button>
                {selectedDoc.plainLanguageContent && (
                  <Button
                    type="button"
                    role="tab"
                    aria-selected={field === "plainLanguageContent"}
                    size="sm"
                    variant={field === "plainLanguageContent" ? "default" : "outline"}
                    onClick={() => selectField("plainLanguageContent")}
                  >
                    Plain language
                  </Button>
                )}
                {selectedDoc.formalContent && (
                  <Button
                    type="button"
                    role="tab"
                    aria-selected={field === "formalContent"}
                    size="sm"
                    variant={field === "formalContent" ? "default" : "outline"}
                    onClick={() => selectField("formalContent")}
                  >
                    Formal version
                  </Button>
                )}
              </div>
              {error && (
                <p
                  role="alert"
                  className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                >
                  {error}
                </p>
              )}
              <label htmlFor="document-content" className="mt-4 block text-sm font-medium">
                Editable content
              </label>
              <Textarea
                id="document-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={18}
                className="mt-2 font-mono text-sm leading-6"
              />
              <div className="mt-4 rounded-lg border bg-muted/50 p-4">
                <h3 className="text-sm font-semibold">Source and citations</h3>
                {(selectedDoc.citations?.length ?? 0) > 0 ? (
                  <ul className="mt-2 space-y-2">
                    {selectedDoc.citations?.map((citation, index) => (
                      <li key={`${citation.label}-${index}`} className="text-sm">
                        <span className="font-medium">{citation.label}</span>
                        <Badge variant="outline" className="ml-2">
                          {citation.verified ? "Verified source" : "Not verified"}
                        </Badge>
                        {citation.url && (
                          <a
                            className="ml-2 text-primary underline"
                            href={citation.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Source link
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {selectedDoc.demoSourcePlaceholder ??
                      "Demo source placeholder — no verified source is attached."}
                  </p>
                )}
                {selectedDoc.demoSourcePlaceholder && (
                  <p className="mt-2 text-xs text-warning-foreground">
                    {selectedDoc.demoSourcePlaceholder}
                  </p>
                )}
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-semibold">Version history</h3>
                {!selectedDoc.versions?.length ? (
                  <p className="mt-2 text-sm text-muted-foreground">No saved versions yet.</p>
                ) : (
                  <ol className="mt-2 space-y-2">
                    {selectedDoc.versions.map((version) => (
                      <li
                        key={version.id}
                        className="flex items-start justify-between gap-3 rounded-lg border p-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{version.note}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDemoDate(version.savedAt)} · {version.content.length} characters
                          </p>
                          <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">
                            {version.content}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="print:hidden"
                          onClick={() => {
                            setField(version.field ?? "content");
                            setContent(version.content);
                          }}
                        >
                          Restore
                        </Button>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <p className="text-xs text-muted-foreground">
                  Review names, dates, facts, authority and official requirements before use. This
                  is a demo draft.
                </p>
                <Button variant="outline" size="sm" className="print:hidden" asChild>
                  <Link to="/cases/$caseId" params={{ caseId: selectedDoc.caseId }}>
                    Return to case
                  </Link>
                </Button>
              </div>
            </>
          )}
        </SurfaceCard>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Printing uses your browser’s print dialog; select “Save as PDF” there. No document is sent
        to any authority.
      </p>
    </>
  );
}
