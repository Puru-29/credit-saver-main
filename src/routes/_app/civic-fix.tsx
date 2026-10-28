import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  Copy,
  ImagePlus,
  Loader2,
  LocateFixed,
  MapPin,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ErrorState, LegalDisclaimer, PageHeader, SurfaceCard } from "@/components/common";
import { AuthoritySelector } from "@/components/flow/AuthoritySelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/case-utils";
import { CIVIC_CATEGORIES, previewAnalysis, type CivicAnalysis } from "@/lib/civic-rules";
import { authorities, authorityService, civicService, createCase } from "@/services/mock-service";

export const Route = createFileRoute("/_app/civic-fix")({
  head: () => ({
    meta: [
      { title: "Civic Fix — NyaySetu" },
      {
        name: "description",
        content: "Report a civic issue with a photo and prepare a complaint draft.",
      },
      { property: "og:title", content: "Civic Fix — NyaySetu" },
      {
        property: "og:description",
        content: "Report a civic issue with a photo and prepare a complaint draft.",
      },
    ],
  }),
  component: CivicFix,
});

const STEPS = ["Report", "Analysis", "Authority", "Review"];
const MAX = 5 * 1024 * 1024;
type Nearby = Awaited<ReturnType<typeof civicService.nearby>>;

function CivicFix() {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [fileErr, setFileErr] = useState("");
  const [drag, setDrag] = useState(false);
  const [f, setF] = useState({
    category: "",
    description: "",
    area: "",
    coords: "",
    lang: "English",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [geo, setGeo] = useState<"idle" | "loading" | "denied" | "error">("idle");
  const [analysis, setAnalysis] = useState<CivicAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [nearby, setNearby] = useState<Nearby>([]);
  const [showDupes, setShowDupes] = useState(false);
  const [auth, setAuth] = useState({ id: "", manual: "" });
  const [draft, setDraft] = useState("");
  const [consent, setConsent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    try {
      const intake = window.sessionStorage.getItem("nyaysetu.issue-intake");
      if (!intake) return;
      const parsed: unknown = JSON.parse(intake);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "description" in parsed &&
        typeof parsed.description === "string"
      ) {
        setF((current) => ({ ...current, description: parsed.description }));
      }
      window.sessionStorage.removeItem("nyaysetu.issue-intake");
    } catch (e) {
      const message = e instanceof Error ? e.message : "The description could not be restored.";
      setErrors((current) => ({
        ...current,
        description: `Could not restore the description: ${message}`,
      }));
    }
  }, []);

  const pick = (fl?: File | null): void => {
    if (!fl) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(fl.type)) {
      setFileErr("Use a JPG, PNG or WebP image.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (fl.size > MAX) {
      setFileErr("Image must be under 5 MB.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFileErr("");
    setFile(fl);
  };
  const removeFile = () => {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setGeo("error");
      return;
    }
    setGeo("loading");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setF((x) => ({
          ...x,
          coords: `${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}`,
        }));
        setGeo("idle");
      },
      (e) => setGeo(e.code === e.PERMISSION_DENIED ? "denied" : "error"),
      { timeout: 10000 },
    );
  };

  const cat = CIVIC_CATEGORIES.find((c) => c.value === f.category);
  const suggestions = (cat?.dept ?? []).map((id, idx) => {
    const a = authorities().find((x) => x.id === id)!;
    return {
      id,
      name: a.name,
      jurisdiction: a.jurisdiction,
      reason:
        idx === 0
          ? `Usually handles ${cat!.label.toLowerCase()} (${a.department}).`
          : "Municipal body — can forward if it isn't the right department.",
    };
  });
  const authName =
    auth.id === "manual" ? auth.manual : (authorities().find((a) => a.id === auth.id)?.name ?? "");

  const toAnalysis = async () => {
    const e: Record<string, string> = {};
    if (!f.category) e["category"] = "Choose a category.";
    if (f.description.trim().length < 15)
      e["description"] = "Describe the problem in at least 15 characters.";
    if (!f.area.trim()) e["area"] = "Enter an address or area.";
    if (f.coords) {
      const match = f.coords.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
      if (
        !match ||
        Number(match[1]) < -90 ||
        Number(match[1]) > 90 ||
        Number(match[2]) < -180 ||
        Number(match[2]) > 180
      )
        e["coords"] =
          "Enter valid coordinates, such as 12.9716, 77.5946 (latitude −90 to 90, longitude −180 to 180).";
    }
    setErrors(e);
    if (Object.keys(e).length) return;
    setStep(1);
    setLoading(true);
    try {
      const [, near] = await Promise.all([
        new Promise((r) => setTimeout(r, 500)),
        civicService.nearby(f.area, f.category),
      ]);
      setAnalysis(previewAnalysis(f.category, f.description));
      setNearby(near);
    } catch (e) {
      setErrors((current) => ({
        ...current,
        analysis:
          e instanceof Error
            ? `Could not prepare the local preview: ${e.message}`
            : "Could not prepare the local preview.",
      }));
    } finally {
      setLoading(false);
    }
  };

  const toReview = () => {
    if (!auth.id || (auth.id === "manual" && !auth.manual.trim())) {
      setErrors((current) => ({ ...current, authority: "Select an authority or enter its name." }));
      toast.error("Select or enter an authority.");
      return;
    }
    setConsent(false);
    setDraft(`[DRAFT FOR REVIEW — NOT SUBMITTED]

To,
${authName}

Subject: Complaint regarding ${cat?.label.toLowerCase()} at ${f.area}

Sir/Madam,

I wish to report the following issue:

${f.description}

Location: ${f.area}${f.coords ? ` (${f.coords})` : ""}
${file ? `A photo was selected locally (${file.name}); it is not uploaded or attached to this case.` : ""}

I request that this be inspected and resolved at the earliest. Please share the complaint reference with me.

Name: [Your name]
Contact: [Phone / email]
Date: [Date]`);
    setStep(3);
  };

  const save = () => {
    try {
      const id = createCase({
        type: "civic_fix",
        title: `${cat?.label} — ${f.area}`,
        summary: f.description,
        authorityId: auth.id === "manual" ? authorityService.createManual(auth.manual) : auth.id,
        documentTitle: "Civic complaint draft",
        documentKind: "complaint",
        dueInDays: 30,
        documentContent: draft,
        evidenceFileName: file?.name,
      });
      toast.success("Draft preview created in this browser session. Nothing has been submitted.");
      void navigate({ to: "/cases/$caseId", params: { caseId: id } });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not save this draft case.";
      setErrors((current) => ({ ...current, save: message }));
      toast.error("Could not create the draft preview.");
    }
  };

  return (
    <>
      <PageHeader
        title="Civic Fix"
        description="Record a local problem and prepare a complaint draft. This preview is not synced to your account."
      />
      <ol className="mb-6 grid grid-cols-4 gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li
            key={s}
            aria-current={i === step ? "step" : undefined}
            className={cn(
              "rounded-lg border px-3 py-2 text-center text-xs font-medium sm:text-sm",
              i === step
                ? "border-teal bg-accent text-accent-foreground"
                : i < step
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground",
            )}
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <SurfaceCard className="space-y-5">
          <div>
            <Label>Photo (optional)</Label>
            {file ? (
              <div className="mt-2 flex items-center gap-4 rounded-lg border p-3">
                <img
                  src={preview}
                  alt="Uploaded issue"
                  className="h-20 w-20 rounded-md object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(0)} KB
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                  Replace
                </Button>
                <Button variant="ghost" size="icon" aria-label="Remove photo" onClick={removeFile}>
                  <X />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  pick(e.dataTransfer.files[0]);
                }}
                className={cn(
                  "mt-2 flex w-full flex-col items-center rounded-lg border-2 border-dashed p-8 text-sm text-muted-foreground",
                  drag && "border-teal bg-accent",
                )}
              >
                <ImagePlus className="h-6 w-6" />
                <span className="mt-2">Drag a photo here or click to choose</span>
                <span className="text-xs">JPG, PNG or WebP · up to 5 MB</span>
              </button>
            )}
            <input
              id="civic-photo"
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-label="Select an issue photo"
              aria-describedby={fileErr ? "civic-photo-error" : "civic-photo-help"}
              onChange={(e) => pick(e.target.files?.[0])}
            />
            <p id="civic-photo-help" className="mt-2 text-xs text-muted-foreground">
              Local preview only. This file is not uploaded or attached to the saved case.
            </p>
            {fileErr && (
              <p id="civic-photo-error" role="alert" className="mt-2 text-sm text-destructive">
                {fileErr}
              </p>
            )}
          </div>
          <div>
            <p id="civic-category-label" className="text-sm font-medium">
              Issue category
            </p>
            <div
              role="group"
              aria-labelledby="civic-category-label"
              className="mt-2 grid gap-2 sm:grid-cols-3"
            >
              {CIVIC_CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  aria-pressed={f.category === c.value}
                  onClick={() => {
                    setF({ ...f, category: c.value });
                    setAuth({ id: "", manual: "" });
                  }}
                  className={cn(
                    "rounded-lg border p-3 text-left text-sm hover:bg-muted",
                    f.category === c.value && "border-teal bg-accent",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
            {errors["category"] && (
              <p role="alert" className="mt-1 text-sm text-destructive">
                {errors["category"]}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              rows={4}
              className="mt-2"
              value={f.description}
              onChange={(e) => setF({ ...f, description: e.target.value })}
              placeholder="What's wrong, since when, and any safety risk"
            />
            {errors["description"] && (
              <p role="alert" className="mt-1 text-sm text-destructive">
                {errors["description"]}
              </p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="area">Address or area</Label>
              <Input
                id="area"
                className="mt-2"
                value={f.area}
                onChange={(e) => setF({ ...f, area: e.target.value })}
                placeholder="e.g. 27th Main, HSR Layout"
              />
              {errors["area"] && <p className="mt-1 text-sm text-destructive">{errors["area"]}</p>}
            </div>
            <div>
              <Label htmlFor="coords">Coordinates (optional)</Label>
              <div className="mt-2 flex gap-2">
                <Input
                  id="coords"
                  value={f.coords}
                  onChange={(e) => setF({ ...f, coords: e.target.value })}
                  placeholder="12.9716, 77.5946"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={locate}
                  disabled={geo === "loading"}
                >
                  {geo === "loading" ? <Loader2 className="animate-spin" /> : <LocateFixed />} Use
                  my location
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Your browser will ask permission. Location stays on this device.
              </p>
              {geo === "denied" && (
                <p className="mt-1 text-sm text-destructive">
                  Location permission denied — type the area instead.
                </p>
              )}
              {geo === "error" && (
                <p className="mt-1 text-sm text-destructive">
                  Couldn't get location — enter it manually.
                </p>
              )}
              {errors["coords"] && (
                <p role="alert" className="mt-1 text-sm text-destructive">
                  {errors["coords"]}
                </p>
              )}
            </div>
          </div>
          <div>
            <Label htmlFor="lang">Preferred language</Label>
            <select
              id="lang"
              className="mt-2 h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={f.lang}
              onChange={(e) => setF({ ...f, lang: e.target.value })}
            >
              <option>English</option>
              <option>Hindi</option>
              <option>Kannada</option>
            </select>
          </div>
          <div className="flex justify-end">
            <Button onClick={toAnalysis}>Continue</Button>
          </div>
        </SurfaceCard>
      )}

      {step === 1 && (
        <SurfaceCard>
          {loading ? (
            <div
              className="flex items-center gap-2 py-10 text-sm text-muted-foreground"
              role="status"
            >
              <Loader2 className="h-4 w-4 animate-spin" /> Preparing local analysis preview…
            </div>
          ) : errors["analysis"] ? (
            <div>
              <ErrorState message={errors["analysis"]} />
              <Button className="mt-4" variant="outline" onClick={() => setStep(0)}>
                <ArrowLeft /> Back to report
              </Button>
            </div>
          ) : analysis ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-xl font-semibold">
                  <Sparkles className="h-5 w-5 text-teal" /> Analysis preview
                </h2>
                <span className="rounded-full bg-warning/20 px-2.5 py-1 text-xs font-medium text-warning-foreground">
                  Illustrative preview — no image analysis was run
                </span>
              </div>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <Item k="Suggested category" v={cat?.label} />
                <Item
                  k="Illustrative confidence"
                  v={`${Math.round(analysis.confidence * 100)}% (rule-based preview only)`}
                />
                <Item
                  k="Suggested severity"
                  v={`${analysis.severity} — ${analysis.severityReason}`}
                />
                <Item k="Possible department" v={suggestions[0]?.name} />
                <Item k="Location" v={`${f.area}${f.coords ? ` · ${f.coords}` : ""}`} />
              </dl>
              {nearby.length > 0 ? (
                <div className="mt-6 rounded-lg border border-warning/50 bg-warning/10 p-4">
                  <p className="flex items-center gap-2 text-sm font-medium text-warning-foreground">
                    <AlertTriangle className="h-4 w-4" /> Possible match in example reports:{" "}
                    {nearby.length}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setShowDupes(!showDupes)}
                  >
                    <Copy /> {showDupes ? "Hide" : "Review"} matching reports
                  </Button>
                  {showDupes && (
                    <ul className="mt-3 space-y-2">
                      {nearby.map((r) => (
                        <li key={r.id} className="rounded-md bg-card p-3 text-sm">
                          <MapPin className="mr-1 inline h-3.5 w-3.5" />
                          {r.title}{" "}
                          <span className="text-xs text-muted-foreground">
                            · {r.area} · {formatDate(r.reportedOn)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    These are illustrative records, not live nearby reports. They are never merged
                    automatically.
                  </p>
                </div>
              ) : (
                <p className="mt-6 text-sm text-muted-foreground">
                  No matching example reports found. Live report search is not connected.
                </p>
              )}
              <Nav
                back={() => setStep(0)}
                next={() => {
                  setAuth({ id: "", manual: "" });
                  setStep(2);
                }}
              />
            </>
          ) : (
            <ErrorState message="The local preview is unavailable. Go back and try again." />
          )}
        </SurfaceCard>
      )}

      {step === 2 && (
        <SurfaceCard>
          <h2 className="mb-4 text-xl font-semibold">Choose the authority</h2>
          <AuthoritySelector
            suggestions={suggestions}
            value={auth.id}
            manual={auth.manual}
            onChange={(id, m) => {
              setAuth({ id, manual: m ?? auth.manual });
              setErrors((current) => ({ ...current, authority: "" }));
            }}
          />
          {errors["authority"] && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {errors["authority"]}
            </p>
          )}
          <Nav back={() => setStep(1)} next={toReview} />
        </SurfaceCard>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <SurfaceCard>
            <h2 className="text-xl font-semibold">Review your complaint</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr]">
              {preview ? (
                <img
                  src={preview}
                  alt="Uploaded issue"
                  className="h-32 w-32 rounded-lg object-cover"
                />
              ) : (
                <div className="grid h-32 w-32 place-items-center rounded-lg bg-muted text-xs text-muted-foreground">
                  No photo
                </div>
              )}
              <dl className="grid gap-3 sm:grid-cols-2">
                <Item k="Category" v={cat?.label} edit={() => setStep(0)} />
                <Item k="Issue description" v={f.description} edit={() => setStep(0)} />
                <Item k="Location" v={f.area} edit={() => setStep(0)} />
                <Item
                  k="Illustrative severity"
                  v={`${analysis?.severity} — ${analysis?.severityReason}`}
                />
                <Item k="Authority" v={authName} edit={() => setStep(2)} />
              </dl>
            </div>
            <Label htmlFor="draft" className="mt-6 block">
              Draft complaint (editable)
            </Label>
            <Textarea
              id="draft"
              rows={16}
              className="mt-2 font-mono text-sm"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            {!draft.trim() && (
              <div className="mt-2">
                <ErrorState message="The draft can't be empty." />
              </div>
            )}
            <label className="mt-4 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 accent-primary"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              I have reviewed this draft. I understand NyaySetu will only save it as a draft case
              and will not submit it to any authority.
            </label>
            {errors["save"] && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {errors["save"]}
              </p>
            )}
            <div className="mt-6 flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft /> Back
              </Button>
              <Button disabled={!consent || !draft.trim()} onClick={save}>
                Save draft case
              </Button>
            </div>
          </SurfaceCard>
          <LegalDisclaimer />
        </div>
      )}
    </>
  );
}

function Item({ k, v, edit }: { k: string; v?: string | undefined; edit?: () => void }) {
  return (
    <div>
      <dt className="flex items-center gap-2 text-xs text-muted-foreground">
        {k}
        {edit && (
          <button onClick={edit} className="text-primary underline">
            Edit
          </button>
        )}
      </dt>
      <dd className="mt-0.5 text-sm">{v || "—"}</dd>
    </div>
  );
}
function Nav({ back, next }: { back: () => void; next: () => void }) {
  return (
    <div className="mt-6 flex justify-between">
      <Button variant="outline" onClick={back}>
        <ArrowLeft /> Back
      </Button>
      <Button onClick={next}>Continue</Button>
    </div>
  );
}
