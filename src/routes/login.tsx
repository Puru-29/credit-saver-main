import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ErrorState } from "@/components/common";
import { Logo } from "@/layouts/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/useAuth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — NyaySetu" },
      { name: "description", content: "Sign in to manage your civic cases." },
      { property: "og:title", content: "Sign in — NyaySetu" },
      { property: "og:description", content: "Sign in to manage your civic cases." },
    ],
  }),
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      await login(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
      toast.success("You are signed in.");
      await navigate({ to: "/dashboard" });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Could not sign in.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-soft"
      >
        <Logo />
        <h1 className="mt-6 text-2xl font-semibold">Sign in</h1>
        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw">Password</Label>
            <Input
              id="pw"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          {error && <ErrorState message={error} />}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link to="/register" className="text-primary underline">
            Register
          </Link>
        </p>
      </form>
    </div>
  );
}
