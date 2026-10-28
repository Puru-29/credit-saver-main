import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ImagePlus, Mic, ScrollText, Shield, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import { LegalDisclaimer, PageHeader, SurfaceCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/new-case")({
  head: () => ({
    meta: [
      { title: "Start a Case — NyaySetu" },
      { name: "description", content: "Describe your problem and choose a module." },
      { property: "og:title", content: "Start a Case — NyaySetu" },
      { property: "og:description", content: "Describe your problem and choose a module." },
    ],
  }),
  component: () => (
    <>
      <PageHeader
        title="Start a Case"
        description="Describe your problem, then pick the module that fits."
      />
      <IssueIntake />
      <LegalDisclaimer className="mt-6" />
    </>
  ),
});

const OPTIONS = [
  {
    to: "/rti",
    icon: ScrollText,
    t: "RTI Assistant",
    d: "Request information from a public office",
  },
  {
    to: "/rights",
    icon: Shield,
    t: "Rights Companion",
    d: "A rights issue with a person or employer",
  },
  { to: "/civic-fix", icon: Wrench, t: "Civic Fix", d: "A local civic problem to report" },
] as const;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function IssueIntake() {
  const [text, setText] = useState("");
  const [mod, setMod] = useState<(typeof OPTIONS)[number]["to"] | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!image) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const selectImage = (file?: File) => {
    setError("");
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setError("Choose a JPG, PNG or WebP image.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("The image must be smaller than 5 MB.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setImage(file);
  };

  const continueToModule = () => {
    if (!text.trim()) {
      setError("Describe the issue before continuing.");
      return;
    }
    if (!mod) {
      setError("Choose a module before continuing.");
      return;
    }
    try {
      window.sessionStorage.setItem(
        "nyaysetu.issue-intake",
        JSON.stringify({ description: text.trim() }),
      );
      void navigate({ to: mod });
    } catch (e) {
      setError(
        e instanceof Error
          ? `Could not pass your description to the selected module: ${e.message}`
          : "Could not pass your description to the selected module.",
      );
      toast.error("Your issue description could not be saved for the selected module.");
    }
  };

  return (
    <SurfaceCard>
      <label htmlFor="issue" className="text-sm font-medium">
        What's the problem?
      </label>
      <Textarea
        id="issue"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError("");
        }}
        rows={5}
        className="mt-2 resize-y"
        placeholder="e.g. Streetlights on my road have not worked for three weeks…"
        aria-invalid={!!error && !text.trim()}
        aria-describedby={error ? "intake-error" : undefined}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {image ? (
          <div className="flex min-w-0 items-center gap-3 rounded-lg border p-2">
            {preview && (
              <img
                src={preview}
                alt="Local preview of selected issue photo"
                className="h-16 w-16 shrink-0 rounded-md object-cover"
              />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{image.name}</span>
              <span className="block text-xs text-muted-foreground">
                Local preview only; not uploaded or attached to the case.
              </span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove selected image"
              onClick={() => {
                setImage(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              <X />
            </Button>
          </div>
        ) : (
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 hover:bg-muted">
            <ImagePlus className="h-4 w-4" /> Attach a local preview
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => selectImage(e.target.files?.[0])}
            />
          </label>
        )}
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-muted-foreground opacity-70"
        >
          <Mic className="h-4 w-4" /> Voice input · Coming soon
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Image preview accepts JPG, PNG or WebP up to 5 MB. No image upload service is connected.
      </p>
      {error && (
        <p id="intake-error" role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <p className="mt-6 text-sm font-medium">Choose a module</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        {OPTIONS.map(({ to, icon: Icon, t, d }) => (
          <button
            key={to}
            type="button"
            onClick={() => {
              setMod(to);
              setError("");
            }}
            aria-pressed={mod === to}
            className={cn(
              "rounded-lg border p-4 text-left transition-colors hover:bg-muted",
              mod === to && "border-teal bg-accent",
            )}
          >
            <Icon className="h-5 w-5 text-primary" />
            <p className="mt-2 font-medium">{t}</p>
            <p className="text-xs text-muted-foreground">{d}</p>
          </button>
        ))}
      </div>
      <div className="mt-6 flex justify-end">
        <Button type="button" onClick={continueToModule}>
          Continue
        </Button>
      </div>
    </SurfaceCard>
  );
}
