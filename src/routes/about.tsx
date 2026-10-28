import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/layouts/AppShell";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "About NyaySetu — NyaySetu" }, { name: "description", content: "A civic-tech project helping citizens follow up on public requests with clear documents and deadlines. NyaySetu is a demo built as a final-year engineering project." }, { property: "og:title", content: "About NyaySetu — NyaySetu" }, { property: "og:description", content: "A civic-tech project helping citizens follow up on public requests with clear documents and deadlines. NyaySetu is a demo built as a final-year engineering project." }] }),
  component: () => (
    <div className="mx-auto max-w-2xl p-6">
      <Logo />
      <h1 className="mt-12 text-3xl font-semibold">About NyaySetu</h1>
      <p className="mt-4 text-muted-foreground">A civic-tech project helping citizens follow up on public requests with clear documents and deadlines. NyaySetu is a demo built as a final-year engineering project.</p>
      <Link to="/" className="mt-8 inline-block text-sm text-primary underline">Back to home</Link>
    </div>
  ),
});
