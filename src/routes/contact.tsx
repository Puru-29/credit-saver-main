import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/layouts/AppShell";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — NyaySetu" },
      { name: "description", content: "Contact information for NyaySetu." },
      { property: "og:title", content: "Contact — NyaySetu" },
      { property: "og:description", content: "Contact information for NyaySetu." },
    ],
  }),
  component: () => (
    <div className="mx-auto max-w-2xl p-6">
      <Logo />
      <h1 className="mt-12 text-3xl font-semibold">Contact</h1>
      <p className="mt-4 text-muted-foreground">
        A support contact has not been configured for this installation.
      </p>
      <Link to="/" className="mt-8 inline-block text-sm text-primary underline">
        Back to home
      </Link>
    </div>
  ),
});
