import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/layouts/AppShell";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: "Contact — NyaySetu" }, { name: "description", content: "This is a demo application. Contact details will be added before any public launch." }, { property: "og:title", content: "Contact — NyaySetu" }, { property: "og:description", content: "This is a demo application. Contact details will be added before any public launch." }] }),
  component: () => (
    <div className="mx-auto max-w-2xl p-6">
      <Logo />
      <h1 className="mt-12 text-3xl font-semibold">Contact</h1>
      <p className="mt-4 text-muted-foreground">This is a demo application. Contact details will be added before any public launch.</p>
      <Link to="/" className="mt-8 inline-block text-sm text-primary underline">Back to home</Link>
    </div>
  ),
});
