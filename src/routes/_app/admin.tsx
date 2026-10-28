import { createFileRoute, Link } from "@tanstack/react-router";
import { LoadingState, PageHeader, StatusBadge, SurfaceCard } from "@/components/common";
import { CASE_STATUS_LABEL, CASE_TYPE_LABEL } from "@/lib/case-utils";
import { authorityService, caseService } from "@/services/mock-service";

export const Route = createFileRoute("/_app/admin")({
  head: () => ({
    meta: [
      { title: "Admin — NyaySetu" },
      { name: "description", content: "Demo analytics derived from shared mock data." },
      { property: "og:title", content: "Admin — NyaySetu" },
      { property: "og:description", content: "Demo case analytics." },
    ],
  }),
  loader: async () => {
    const [cases, escalations] = await Promise.all([
      caseService.all(),
      caseService.allEscalations(),
    ]);
    return { cases, escalations };
  },
  pendingComponent: () => <LoadingState label="Loading demo analytics…" />,
  component: AdminPage,
});

function AdminPage() {
  const { cases, escalations } = Route.useLoaderData();
  const active = cases.filter((c) => c.status !== "closed").length;
  const breached = cases.filter((c) => c.status === "deadline_breached").length;
  const cards = [
    { label: "Total cases", value: cases.length },
    { label: "Active cases", value: active },
    { label: "Breached cases", value: breached },
    { label: "Escalations", value: escalations.length },
  ];
  const moduleDistribution = Object.entries(CASE_TYPE_LABEL).map(([type, label]) => ({
    label,
    count: cases.filter((c) => c.type === type).length,
  }));
  const statusDistribution = Object.entries(CASE_STATUS_LABEL)
    .map(([status, label]) => ({ label, count: cases.filter((c) => c.status === status).length }))
    .filter((item) => item.count > 0);
  const maxModule = Math.max(1, ...moduleDistribution.map((item) => item.count));
  const maxStatus = Math.max(1, ...statusDistribution.map((item) => item.count));

  return (
    <>
      <PageHeader
        title="Admin overview"
        description="Demo analytics from the shared mock cases and escalation records. No live platform data."
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => (
          <SurfaceCard key={card.label}>
            <p className="text-3xl font-semibold">{card.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{card.label}</p>
          </SurfaceCard>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SurfaceCard>
          <h2 className="font-semibold">Module distribution</h2>
          <ul className="mt-4 space-y-4">
            {moduleDistribution.map((item) => (
              <li key={item.label}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{item.label}</span>
                  <span className="font-medium">{item.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(item.count / maxModule) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </SurfaceCard>
        <SurfaceCard>
          <h2 className="font-semibold">Status distribution</h2>
          <ul className="mt-4 space-y-4">
            {statusDistribution.map((item) => (
              <li key={item.label}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{item.label}</span>
                  <span className="font-medium">{item.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-teal"
                    style={{ width: `${(item.count / maxStatus) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </SurfaceCard>
      </div>
      <SurfaceCard className="mt-4 overflow-x-auto p-0">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-semibold">All demo cases</h2>
          <span className="text-xs text-muted-foreground">{cases.length} total</span>
        </div>
        {cases.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No demo cases are available.</p>
        ) : (
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-3">ID</th>
                <th className="px-3 py-3">Issue</th>
                <th className="px-3 py-3">Module</th>
                <th className="px-3 py-3">Authority</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cases.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-3 font-mono text-xs">
                    <Link
                      to="/cases/$caseId"
                      params={{ caseId: c.id }}
                      className="hover:text-primary"
                    >
                      {c.id}
                    </Link>
                  </td>
                  <td className="px-3 py-3">{c.title}</td>
                  <td className="px-3 py-3 text-xs">{CASE_TYPE_LABEL[c.type]}</td>
                  <td className="px-3 py-3 text-xs">
                    {authorityService.get(c.authorityId)?.name ?? "Not set"}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SurfaceCard>
      <p className="mt-3 text-xs text-muted-foreground">
        Counts and charts are calculated from the same in-memory demo case and escalation records.
      </p>
    </>
  );
}
