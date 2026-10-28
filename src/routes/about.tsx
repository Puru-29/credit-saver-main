import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/layouts/AppShell";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About NyaySetu — NyaySetu" },
      {
        name: "description",
        content:
          "NyaySetu provides tools to organize civic and rights concerns and prepare drafts for review.",
      },
      { property: "og:title", content: "About NyaySetu — NyaySetu" },
      {
        property: "og:description",
        content: "Tools to organize civic and rights concerns and prepare drafts for review.",
      },
    ],
  }),
  component: () => (
    <div className="mx-auto max-w-2xl p-6">
      <Logo />
      <h1 className="mt-12 text-3xl font-semibold">About NyaySetu</h1>
      <p className="mt-4 leading-7 text-muted-foreground">
        NyaySetu provides tools to organize civic and rights concerns, prepare draft documents, and
        keep follow-up information together. The tools do not provide legal representation,
        determine legal rights, or submit requests to public authorities.
      </p>
      <Link to="/" className="mt-8 inline-block text-sm text-primary underline">
        Back to home
      </Link>
    </div>
  ),
});
