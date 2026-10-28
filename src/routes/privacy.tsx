import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/layouts/AppShell";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy — NyaySetu" }, { name: "description", content: "In Demo Mode, nothing leaves your browser. No personal data is collected, stored on a server, or shared with any authority." }, { property: "og:title", content: "Privacy — NyaySetu" }, { property: "og:description", content: "In Demo Mode, nothing leaves your browser. No personal data is collected, stored on a server, or shared with any authority." }] }),
  component: () => (
    <div className="mx-auto max-w-2xl p-6">
      <Logo />
      <h1 className="mt-12 text-3xl font-semibold">Privacy</h1>
      <p className="mt-4 text-muted-foreground">In Demo Mode, nothing leaves your browser. No personal data is collected, stored on a server, or shared with any authority.</p>
      <Link to="/" className="mt-8 inline-block text-sm text-primary underline">Back to home</Link>
    </div>
  ),
});
