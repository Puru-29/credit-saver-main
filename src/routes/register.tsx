import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ErrorState } from "@/components/common";
import { Logo } from "@/layouts/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/useAuth";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create account — NyaySetu" },
      { name: "description", content: "Create account to manage your civic cases." },
      { property: "og:title", content: "Create account — NyaySetu" },
      { property: "og:description", content: "Create account to manage your civic cases." },
    ],
  }),
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      await register(
        String(form.get("name") ?? ""),
        String(form.get("email") ?? ""),
        String(form.get("password") ?? ""),
      );
      toast.success("Your account has been created.");
      await navigate({ to: "/dashboard" });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Could not create your account.";
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
        <h1 className="mt-6 text-2xl font-semibold">Create account</h1>
        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              minLength={2}
              maxLength={100}
              required
            />
          </div>
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
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          {error && <ErrorState message={error} />}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Creating account…" : "Create account"}
          </Button>
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Have an account?{" "}
          <Link to="/login" className="text-primary underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
