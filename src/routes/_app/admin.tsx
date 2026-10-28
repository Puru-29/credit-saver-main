import { createFileRoute } from "@tanstack/react-router";
import { AdminUnavailable } from "@/components/admin/AdminUnavailable";

export const Route = createFileRoute("/_app/admin")({
  head: () => ({
    meta: [
      { title: "Admin overview — NyaySetu" },
      {
        name: "description",
        content:
          "Admin analytics are unavailable until role-based access and live analytics are supported.",
      },
    ],
  }),
  component: AdminUnavailable,
});
