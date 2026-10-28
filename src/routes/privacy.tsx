import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/layouts/AppShell";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy — NyaySetu" },
      {
        name: "description",
        content:
          "Learn how NyaySetu handles account information, browser-side drafts, and external submissions.",
      },
      { property: "og:title", content: "Privacy — NyaySetu" },
      {
        property: "og:description",
        content: "Information about account data and browser-side draft handling.",
      },
    ],
  }),
  component: () => (
    <div className="mx-auto max-w-2xl p-6">
      <Logo />
      <h1 className="mt-12 text-3xl font-semibold">Privacy</h1>
      <div className="mt-4 space-y-4 leading-7 text-muted-foreground">
        <p>
          Sign-in and profile requests are sent to the NyaySetu API configured for this
          installation. Authentication tokens are kept in this browser session.
        </p>
        <p>
          Case and document tools currently use local preview data. Some unfinished drafts may be
          kept in this browser; they are not currently saved to your NyaySetu account.
        </p>
        <p>
          NyaySetu does not submit applications or complaints to authorities. Do not enter sensitive
          information unless you understand how this installation is configured and operated.
        </p>
      </div>
      <Link to="/" className="mt-8 inline-block text-sm text-primary underline">
        Back to home
      </Link>
    </div>
  ),
});
