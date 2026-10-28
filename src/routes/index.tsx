import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  FileCheck2,
  LockKeyhole,
  MessageSquareText,
  Scale,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { MODULES } from "@/data/modules";
import { Logo } from "@/layouts/AppShell";
import { LegalDisclaimer } from "@/components/common";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NyaySetu — Your Rights. Your Voice. Your Follow-up." },
      {
        name: "description",
        content:
          "Organize civic and rights concerns, prepare drafts for review, and keep track of your next steps.",
      },
      { property: "og:title", content: "NyaySetu — Your Rights. Your Voice. Your Follow-up." },
      {
        property: "og:description",
        content: "Tools to organize civic and rights concerns and prepare drafts for your review.",
      },
    ],
  }),
  component: Landing,
});

const steps = [
  {
    icon: MessageSquareText,
    title: "Describe the issue",
    description: "Capture the key facts in your own words.",
  },
  {
    icon: FileCheck2,
    title: "Prepare a draft",
    description: "Review and edit a structured document before deciding what to do.",
  },
  {
    icon: Timer,
    title: "Keep track",
    description: "Record dates and follow-up tasks you choose to monitor.",
  },
];

const trust = [
  {
    icon: ShieldCheck,
    title: "Suggestions are not legal advice",
    description:
      "Guidance and generated text are informational. Verify requirements with an official source or qualified professional.",
  },
  {
    icon: LockKeyhole,
    title: "Know where your information goes",
    description:
      "Sign-in and profile use the configured NyaySetu API. Case and document tools currently use local preview data.",
  },
  {
    icon: Check,
    title: "You stay in control",
    description:
      "Drafts are for your review. NyaySetu does not submit applications or complaints to an authority.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Logo />
          <nav aria-label="Main navigation" className="hidden items-center gap-6 text-sm md:flex">
            <a
              href="#how"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              How it works
            </a>
            <a
              href="#services"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Services
            </a>
            <Link
              to="/about"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              About
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/register">Create account</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b bg-secondary/30">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
            <div className="relative z-10">
              <p className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-primary">
                <Scale aria-hidden="true" className="h-3.5 w-3.5" />
                Civic and rights support tools
              </p>
              <h1 className="mt-6 max-w-2xl font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                Make your next step <span className="text-primary">clearer.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                Organize the details of a civic or rights concern, prepare a draft, and keep your
                follow-up information together.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" asChild>
                  <Link to="/new-case">
                    Explore the tools <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <a href="#how">How it works</a>
                </Button>
              </div>
              <p className="mt-4 max-w-xl text-xs leading-5 text-muted-foreground">
                Drafts are not submissions. Dates and suggestions are not verified legal advice.
              </p>
            </div>

            <div
              aria-label="Three steps: describe, prepare, review"
              className="relative mx-auto w-full max-w-md"
            >
              <div className="absolute -inset-5 rounded-[2rem] bg-primary/5 blur-2xl" />
              <div className="relative rounded-2xl border bg-card p-5 shadow-soft sm:p-7">
                <div className="flex items-center justify-between border-b pb-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      A considered next step
                    </p>
                    <h2 className="mt-1 font-display text-xl font-semibold">
                      Start with the facts
                    </h2>
                  </div>
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Scale aria-hidden="true" className="h-5 w-5" />
                  </span>
                </div>
                <ol className="mt-5 space-y-4">
                  {steps.map(({ icon: Icon, title, description }, index) => (
                    <li key={title} className="flex gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border bg-background text-primary">
                        <Icon aria-hidden="true" className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold">
                          <span className="mr-2 font-mono text-xs text-muted-foreground">
                            0{index + 1}
                          </span>
                          {title}
                        </p>
                        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                          {description}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="mt-5 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs leading-5 text-warning-foreground">
                  No application or complaint is filed or sent from this page.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="services" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-primary">Explore NyaySetu</p>
            <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
              Practical tools, with room for your judgment
            </h2>
            <p className="mt-3 text-muted-foreground">
              Choose a starting point. Review every suggestion and confirm details independently.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {MODULES.map(({ to, icon: Icon, t, d }) => (
              <Link
                key={to}
                to={to}
                className="group rounded-xl border bg-card p-6 shadow-soft transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-primary">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-lg font-semibold">{t}</h3>
                <p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground">{d}</p>
                <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Explore{" "}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section id="how" className="scroll-mt-20 border-y bg-card">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-sm font-semibold text-primary">A simple process</p>
              <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
                From a concern to an organized draft
              </h2>
              <p className="mt-4 leading-7 text-muted-foreground">
                Keep your description, supporting notes, and draft text in one place. You decide
                what to verify and what action to take next.
              </p>
            </div>
            <ol className="space-y-3">
              {steps.map(({ title, description }, index) => (
                <li key={title} className="flex gap-4 rounded-xl border bg-background p-4">
                  <span className="font-display text-xl font-semibold text-primary">
                    0{index + 1}
                  </span>
                  <div>
                    <p className="font-semibold">{title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-primary">Built around clarity</p>
            <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
              Helpful boundaries matter
            </h2>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {trust.map(({ icon: Icon, title, description }) => (
              <article key={title} className="border-t-2 border-primary/20 pt-5">
                <Icon aria-hidden="true" className="h-5 w-5 text-primary" />
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
              </article>
            ))}
          </div>
          <div className="mt-10 rounded-xl border bg-secondary/30 p-5 sm:p-6">
            <h3 className="font-semibold">Service availability</h3>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
              Sign-in and profile use the configured NyaySetu API. Case and document workflows
              currently use local preview data and are not saved to your account. No external
              authority integration is connected.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t bg-card">
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
          <LegalDisclaimer />
          <div className="flex flex-col justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
            <p>© 2026 NyaySetu</p>
            <div className="flex gap-6">
              <Link to="/about" className="hover:text-foreground">
                About
              </Link>
              <Link to="/contact" className="hover:text-foreground">
                Contact
              </Link>
              <Link to="/privacy" className="hover:text-foreground">
                Privacy
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
