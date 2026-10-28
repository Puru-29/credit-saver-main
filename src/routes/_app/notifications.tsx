import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Bell, CheckCheck } from "lucide-react";
import { EmptyState, LoadingState, PageHeader, SurfaceCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { formatDemoDate } from "@/lib/case-utils";
import { notificationService } from "@/services/mock-service";

export const Route = createFileRoute("/_app/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — NyaySetu" },
      { name: "description", content: "Demo deadline, draft and case updates." },
      { property: "og:title", content: "Notifications — NyaySetu" },
      { property: "og:description", content: "Demo deadline and case updates." },
    ],
  }),
  loader: () => notificationService.list(),
  pendingComponent: () => <LoadingState label="Loading notifications…" />,
  component: NotificationsPage,
});

function NotificationsPage() {
  const items = Route.useLoaderData();
  const router = useRouter();
  const [filter, setFilter] = useState<
    "all" | "unread" | "deadline" | "draft" | "response" | "escalation"
  >("all");
  const [error, setError] = useState("");
  const unreadCount = items.filter((item) => !item.read).length;
  const visible = items.filter(
    (item) => filter === "all" || (filter === "unread" ? !item.read : item.category === filter),
  );
  const updateRead = async (id: string, read: boolean) => {
    setError("");
    try {
      notificationService.markRead(id, read);
      await router.invalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update notification.");
    }
  };
  const markAll = async () => {
    setError("");
    try {
      notificationService.markAllRead();
      await router.invalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update notifications.");
    }
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        description="In-app demo reminders for deadlines, drafts, responses and escalation review."
        actions={
          <Button variant="outline" onClick={() => void markAll()} disabled={!unreadCount}>
            <CheckCheck /> Mark all read
          </Button>
        }
      />
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter notifications">
        {(["all", "unread", "deadline", "draft", "response", "escalation"] as const).map(
          (value) => (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? "default" : "outline"}
              onClick={() => setFilter(value)}
            >
              {value === "all"
                ? "All"
                : value === "unread"
                  ? `Unread (${unreadCount})`
                  : `${value[0]!.toUpperCase()}${value.slice(1)} updates`}
            </Button>
          ),
        )}
      </div>
      {visible.length === 0 ? (
        <EmptyState
          title={items.length ? "No notifications in this view" : "You're all caught up"}
          description={
            items.length
              ? "Choose another filter to see more updates."
              : "Demo reminders appear here when a case has a deadline, saved draft, response update or escalation draft."
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((item) => (
            <SurfaceCard key={item.id} className={item.read ? "" : "border-teal"}>
              <div className="flex items-start gap-3">
                <Bell
                  className={`mt-0.5 h-4 w-4 shrink-0 ${item.read ? "text-muted-foreground" : "text-teal"}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{item.title}</p>
                    {!item.read && (
                      <span className="rounded-full bg-teal/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                        Unread
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatDemoDate(item.at)}
                    {item.category && ` · ${item.category}`}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {item.caseId && (
                      <Link
                        to="/cases/$caseId"
                        params={{ caseId: item.caseId }}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        Open case
                      </Link>
                    )}
                    <button
                      type="button"
                      className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                      onClick={() => void updateRead(item.id, !item.read)}
                    >
                      {item.read ? "Mark unread" : "Mark read"}
                    </button>
                  </div>
                </div>
              </div>
            </SurfaceCard>
          ))}
        </div>
      )}
    </>
  );
}
