import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Download, Pencil, Printer, Save } from "lucide-react";
import { toast } from "sonner";
import { LegalDisclaimer, SurfaceCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type Answers = Record<string, string>;
export interface Question {
  id: string;
  prompt: string;
  hint?: string;
  type: "text" | "textarea" | "number" | "date" | "choice";
  options?: { value: string; label: string; note?: string }[];
  optional?: boolean;
  when?: (a: Answers) => boolean;
}

interface Props {
  storageKey: string;
  initialAnswerId?: string;
  questions: Question[];
  buildDocument: (a: Answers) => string;
  renderResult?: (a: Answers) => ReactNode;
  onCreateCase: (a: Answers, documentContent: string) => string;
  documentTitle: string;
}

type Phase = "ask" | "review" | "document";

export function GuidedFlow({
  storageKey,
  initialAnswerId,
  questions,
  buildDocument,
  renderResult,
  onCreateCase,
  documentTitle,
}: Props) {
  const [answers, setAnswers] = useState<Answers>({});
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<Phase>("ask");
  const [doc, setDoc] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const saved: unknown = JSON.parse(raw);
        if (typeof saved !== "object" || saved === null)
          throw new Error("Saved draft has an invalid format.");
        const record = saved as { answers?: unknown; doc?: unknown; phase?: unknown };
        if (
          typeof record.answers === "object" &&
          record.answers !== null &&
          !Array.isArray(record.answers)
        ) {
          setAnswers(
            Object.fromEntries(
              Object.entries(record.answers).filter(
                (entry): entry is [string, string] => typeof entry[1] === "string",
              ),
            ),
          );
        }
        if (typeof record.doc === "string") setDoc(record.doc);
        if (record.phase === "ask" || record.phase === "review" || record.phase === "document") {
          setPhase(record.phase);
        }
        toast.info("Restored your saved draft");
      }
      if (initialAnswerId) {
        const intake = window.sessionStorage.getItem("nyaysetu.issue-intake");
        if (intake) {
          const parsed: unknown = JSON.parse(intake);
          if (
            typeof parsed === "object" &&
            parsed !== null &&
            "description" in parsed &&
            typeof parsed.description === "string"
          ) {
            setAnswers((current) => ({ ...current, [initialAnswerId]: parsed.description }));
          }
          window.sessionStorage.removeItem("nyaysetu.issue-intake");
        }
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? `Could not restore the saved draft: ${e.message}`
          : "Could not restore the saved draft.",
      );
    }
  }, [initialAnswerId, storageKey]);

  const active = questions.filter((q) => !q.when || q.when(answers));
  const activeIndex = Math.min(i, Math.max(active.length - 1, 0));
  const q = active[activeIndex];
  const value = q ? (answers[q.id] ?? "") : "";
  useEffect(() => {
    if (i !== activeIndex) setI(activeIndex);
  }, [activeIndex, i]);

  const set = (v: string) => {
    if (!q) return;
    setAnswers((a) => ({ ...a, [q.id]: v }));
    setError("");
  };

  const saveDraft = () => {
    setError("");
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ answers, doc, phase }));
      toast.success("Draft saved on this device");
    } catch (e) {
      const message = e instanceof Error ? e.message : "The browser could not save this draft.";
      setError(`Could not save your draft: ${message}`);
      toast.error("Could not save the draft on this device.");
    }
  };
  const next = () => {
    if (!q) return setError("No question is available. Please reload this page.");
    if (!q.optional && !value.trim())
      return setError("Please answer this to continue, or go back.");
    if (q.type === "number" && value && (!Number.isFinite(Number(value)) || Number(value) < 0))
      return setError("Enter a valid non-negative number.");
    if (activeIndex + 1 < active.length) setI(activeIndex + 1);
    else setPhase("review");
  };
  const toDocument = () => {
    try {
      setDoc(buildDocument(answers));
      setError("");
      setPhase("document");
    } catch (e) {
      setError(
        e instanceof Error
          ? `Could not prepare the document draft: ${e.message}`
          : "Could not prepare the document draft.",
      );
    }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([doc], { type: "text/plain" }));
    const anchor = Object.assign(document.createElement("a"), {
      href: url,
      download: `${documentTitle.replace(/\W+/g, "-")}.txt`,
    });
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const print = () => {
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Allow pop-ups to open the print preview.");
      return;
    }
    const pre = w.document.createElement("pre");
    pre.style.cssText = "font-family:Georgia,serif;white-space:pre-wrap;padding:40px";
    pre.textContent = doc;
    w.document.body.append(pre);
    w.document.close();
    w.print();
  };
  const createCase = () => {
    setError("");
    try {
      const id = onCreateCase(answers, doc);
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        toast.error("The case was created, but the saved local draft could not be removed.");
      }
      toast.success("Draft preview created in this browser session. Nothing has been submitted.");
      void navigate({ to: "/cases/$caseId", params: { caseId: id } }).catch((e: unknown) => {
        setError(
          e instanceof Error
            ? `The case was created, but its page could not be opened: ${e.message}`
            : "The case was created, but its page could not be opened.",
        );
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? `Could not create the case: ${e.message}`
          : "Could not create the case.",
      );
    }
  };

  if (phase === "review")
    return (
      <SurfaceCard>
        <h2 className="text-xl font-semibold">Review your answers</h2>
        <dl className="mt-4 divide-y">
          {active.map((x, idx) => (
            <div key={x.id} className="flex items-start justify-between gap-4 py-3">
              <div>
                <dt className="text-xs text-muted-foreground">{x.prompt}</dt>
                <dd className="mt-0.5 text-sm">{label(x, answers[x.id]) || "—"}</dd>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setI(idx);
                  setError("");
                  setPhase("ask");
                }}
              >
                <Pencil /> Edit
              </Button>
            </div>
          ))}
        </dl>
        <div className="mt-6 flex flex-wrap justify-between gap-2">
          <Button variant="outline" onClick={() => setPhase("ask")}>
            <ArrowLeft /> Back
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={saveDraft}>
              <Save /> Save Draft
            </Button>
            <Button onClick={toDocument}>Continue</Button>
          </div>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}
      </SurfaceCard>
    );

  if (phase === "document")
    return (
      <div className="space-y-6">
        {renderResult?.(answers)}
        <SurfaceCard>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold">{documentTitle}</h2>
            <span className="rounded-full bg-warning/20 px-2.5 py-1 text-xs font-medium text-warning-foreground">
              Local draft template — review and edit before use
            </span>
          </div>
          <Textarea
            value={doc}
            onChange={(e) => setDoc(e.target.value)}
            rows={22}
            className="mt-4 font-mono text-sm"
            aria-label="Document text"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            You must review every line. NyaySetu never submits documents for you.
          </p>
          {error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="mt-4 flex flex-wrap justify-between gap-2">
            <Button variant="outline" onClick={() => setPhase("review")}>
              <ArrowLeft /> Back
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={saveDraft}>
                <Save /> Save Draft
              </Button>
              <Button variant="outline" onClick={download}>
                <Download /> Download
              </Button>
              <Button variant="outline" onClick={print}>
                <Printer /> Print
              </Button>
              <Button onClick={createCase} disabled={!doc.trim()}>
                <CheckCircle2 /> Create Case
              </Button>
            </div>
          </div>
        </SurfaceCard>
        <LegalDisclaimer />
      </div>
    );

  return (
    <SurfaceCard>
      {q ? (
        <>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Question {activeIndex + 1} of {active.length}
            </span>
            <button
              type="button"
              onClick={saveDraft}
              className="rounded-sm underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Save draft
            </button>
          </div>
          <Progress value={((activeIndex + 1) / active.length) * 100} className="mt-2 h-1.5" />
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              next();
            }}
            className="mt-6"
          >
            {q.type === "choice" ? (
              <p id={`${q.id}-prompt`} className="font-display text-xl font-semibold">
                {q.prompt}
              </p>
            ) : (
              <label htmlFor={q.id} className="font-display text-xl font-semibold">
                {q.prompt}
              </label>
            )}
            {q.hint && (
              <p id={`${q.id}-hint`} className="mt-1 text-sm text-muted-foreground">
                {q.hint}
              </p>
            )}
            <div className="mt-4">
              {q.type === "choice" ? (
                <div
                  role="group"
                  aria-labelledby={`${q.id}-prompt`}
                  aria-describedby={
                    [q.hint && `${q.id}-hint`, error && `${q.id}-error`]
                      .filter(Boolean)
                      .join(" ") || undefined
                  }
                  className="grid gap-2 sm:grid-cols-2"
                >
                  {(q.options ?? []).map((o) => (
                    <button
                      type="button"
                      key={o.value}
                      onClick={() => set(o.value)}
                      aria-pressed={value === o.value}
                      className={cn(
                        "rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted",
                        value === o.value && "border-teal bg-accent",
                      )}
                    >
                      <span className="font-medium">{o.label}</span>
                      {o.note && (
                        <span className="block text-xs text-muted-foreground">{o.note}</span>
                      )}
                    </button>
                  ))}
                </div>
              ) : q.type === "textarea" ? (
                <Textarea
                  id={q.id}
                  aria-required={!q.optional}
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  rows={4}
                  autoFocus
                  aria-invalid={!!error}
                  aria-describedby={
                    [q.hint && `${q.id}-hint`, error && `${q.id}-error`]
                      .filter(Boolean)
                      .join(" ") || undefined
                  }
                />
              ) : (
                <Input
                  id={q.id}
                  type={q.type}
                  min={q.type === "number" ? 0 : undefined}
                  aria-required={!q.optional}
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  autoFocus
                  aria-invalid={!!error}
                  aria-describedby={
                    [q.hint && `${q.id}-hint`, error && `${q.id}-error`]
                      .filter(Boolean)
                      .join(" ") || undefined
                  }
                />
              )}
            </div>
            {error && (
              <p id={`${q.id}-error`} role="alert" className="mt-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="mt-6 flex justify-between">
              <Button
                type="button"
                variant="outline"
                disabled={activeIndex === 0}
                onClick={() => setI(activeIndex - 1)}
              >
                <ArrowLeft /> Back
              </Button>
              <div className="flex gap-2">
                {q.optional && !value && (
                  <Button type="button" variant="ghost" onClick={next}>
                    Skip
                  </Button>
                )}
                <Button type="submit">Continue</Button>
              </div>
            </div>
          </form>
        </>
      ) : (
        <p role="alert" className="text-sm text-destructive">
          No questions are available for this guided flow.
        </p>
      )}
    </SurfaceCard>
  );
}

export function label(q: Question, v?: string) {
  return q.options?.find((o) => o.value === v)?.label ?? v ?? "";
}
