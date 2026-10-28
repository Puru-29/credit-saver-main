import { useState } from "react";
import { Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface AuthoritySuggestion { id: string; name: string; reason: string; jurisdiction?: string }

/** Reusable selector: up to three demo suggestions plus a manual correction. */
export function AuthoritySelector({ suggestions, value, manual, onChange }: {
  suggestions: AuthoritySuggestion[];
  value: string;
  manual: string;
  onChange: (id: string, manualName?: string) => void;
}) {
  const [showManual, setShowManual] = useState(value === "manual");
  return (
    <fieldset>
      <legend className="sr-only">Select the responsible authority</legend>
      <p className="mb-3 text-xs text-muted-foreground">Demo suggestions — not verified. Confirm or correct before use.</p>
      <div className="space-y-2">
        {suggestions.slice(0, 3).map((s) => (
          <label key={s.id} className={cn("flex cursor-pointer gap-3 rounded-lg border p-4 hover:bg-muted", value === s.id && "border-teal bg-accent")}>
            <input type="radio" name="authority" className="mt-1 accent-primary" checked={value === s.id} onChange={() => { setShowManual(false); onChange(s.id); }} />
            <span>
              <span className="flex items-center gap-2 font-medium"><Building2 className="h-4 w-4 text-primary" />{s.name}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{s.reason}</span>
              {s.jurisdiction && <span className="mt-1 block text-xs text-muted-foreground">Jurisdiction: {s.jurisdiction}</span>}
            </span>
          </label>
        ))}
        <label className={cn("flex cursor-pointer gap-3 rounded-lg border p-4 hover:bg-muted", value === "manual" && "border-teal bg-accent")}>
          <input type="radio" name="authority" className="mt-1 accent-primary" checked={value === "manual"} onChange={() => { setShowManual(true); onChange("manual", manual); }} />
          <span className="flex-1"><span className="font-medium">None of these — enter manually</span>
            {showManual && <Input className="mt-2" placeholder="Office name" value={manual} onChange={(e) => onChange("manual", e.target.value)} aria-label="Authority name" />}
          </span>
        </label>
      </div>
    </fieldset>
  );
}
