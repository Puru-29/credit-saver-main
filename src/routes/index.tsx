import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Eye, FileCheck2, Lock, MessageSquareText, Repeat, ScrollText, Shield, Timer, UserCheck, Wrench, Compass } from "lucide-react";
import { MODULES } from "@/data/modules";
import { Logo } from "@/layouts/AppShell";
import { LegalDisclaimer } from "@/components/common";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "NyaySetu — Your Rights. Your Voice. Your Follow-up." }, { name: "description", content: "Prepare civic documents, identify possible authorities and track deadlines until you get a response." }, { property: "og:title", content: "NyaySetu — Your Rights. Your Voice. Your Follow-up." }, { property: "og:description", content: "Deadline-driven civic and rights assistance for Indian citizens." }] }),
  component: Landing,
});


const steps = [
  { icon: MessageSquareText, t: "Describe Your Problem" },
  { icon: FileCheck2, t: "Prepare Your Document" },
  { icon: Timer, t: "Track Your Deadline" },
  { icon: Compass, t: "Review Your Next Step" },
];

const trust = [
  { icon: Eye, t: "Responsible assistance", d: "Suggestions are clearly labelled and never presented as legal advice or verified facts." },
  { icon: UserCheck, t: "Human review", d: "You review and approve every document. Nothing is submitted on your behalf." },
  { icon: Lock, t: "Privacy first", d: "In Demo Mode your data stays in your browser. Sensitive details are never shared." },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 p-4">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#how" className="hover:text-foreground">How It Works</a>
            <a href="#services" className="hover:text-foreground">Our Services</a>
            <Link to="/about" className="hover:text-foreground">About</Link>
          </nav>
          <Button variant="outline" size="sm" asChild><Link to="/login">Login</Link></Button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <span className="rounded-full bg-warning/20 px-3 py-1 text-xs font-medium text-warning-foreground">Demo Mode</span>
        <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight sm:text-6xl">Your Rights. Your Voice. <span className="text-teal">Your Follow-up.</span></h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">NyaySetu helps you prepare documents, identify a possible authority and track every deadline — so your request doesn't quietly disappear.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" asChild><Link to="/new-case">Start a Case <ArrowRight /></Link></Button>
          <Button size="lg" variant="outline" asChild><a href="#how">Explore How It Works</a></Button>
        </div>
      </section>

      <section id="services" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12 sm:px-6">
        <h2 className="text-3xl font-semibold">Our Services</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {MODULES.map(({ to, icon: Icon, t, d }) => (
            <Link key={to} to={to} className="group rounded-xl border bg-card p-6 shadow-soft transition-colors hover:border-teal">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary"><Icon className="h-5 w-5" /></span>
              <h3 className="mt-4 text-xl font-semibold">{t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{d}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">Open <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
            </Link>
          ))}
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12 sm:px-6">
        <h2 className="text-3xl font-semibold">How It Works</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, t }, i) => (
            <li key={t} className="rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between"><Icon className="h-5 w-5 text-teal" /><span className="font-mono text-xs text-muted-foreground">0{i + 1}</span></div>
              <p className="mt-4 font-semibold">{t}</p>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex gap-4 rounded-xl bg-primary p-6 text-primary-foreground">
          <Repeat className="h-6 w-6 shrink-0" />
          <div>
            <h3 className="text-xl font-semibold">The accountability loop</h3>
            <p className="mt-2 text-sm opacity-90">Every case carries a statutory or suggested deadline. When it passes without a response, NyaySetu flags the breach and prepares an escalation draft — first appeal, grievance or legal aid — for you to review. The loop repeats until you get an answer or close the case.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h2 className="text-3xl font-semibold">Responsible by design</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {trust.map(({ icon: Icon, t, d }) => (
            <div key={t}><Icon className="h-5 w-5 text-primary" /><h3 className="mt-3 font-semibold">{t}</h3><p className="mt-1 text-sm text-muted-foreground">{d}</p></div>
          ))}
        </div>
      </section>

      <footer className="mt-12 border-t bg-card">
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-10 sm:px-6">
          <LegalDisclaimer />
          <div className="flex flex-col justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
            <p>© 2026 NyaySetu · Demo project</p>
            <div className="flex gap-6"><Link to="/about">About</Link><Link to="/contact">Contact</Link><Link to="/privacy">Privacy</Link></div>
          </div>
        </div>
      </footer>
    </div>
  );
}
