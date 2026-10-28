import { AlertCircle } from "lucide-react";
import { PageHeader, SurfaceCard } from "@/components/common";

export function AdminUnavailable() {
  return (
    <>
      <PageHeader
        title="Admin overview"
        description="Platform analytics are not available for this account."
      />
      <SurfaceCard>
        <div className="flex items-start gap-3">
          <AlertCircle
            aria-hidden="true"
            className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
          />
          <div>
            <h2 className="font-semibold">Admin access is not configured</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This application does not currently provide verified administrator roles or a
              protected analytics API. No platform statistics are shown.
            </p>
          </div>
        </div>
      </SurfaceCard>
    </>
  );
}
