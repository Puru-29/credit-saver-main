import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Logo } from "@/layouts/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — NyaySetu" }, { name: "description", content: "Sign in to manage your civic cases." }, { property: "og:title", content: "Sign in — NyaySetu" }, { property: "og:description", content: "Sign in to manage your civic cases." }] }),
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const isRegister = false;
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <form onSubmit={(e) => { e.preventDefault(); navigate({ to: "/dashboard" }); }} className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-soft">
        <Logo />
        <h1 className="mt-6 text-2xl font-semibold">Sign in</h1>
        <p className="mt-1 text-xs text-muted-foreground">Demo only — no real account is created.</p>
        <div className="mt-6 space-y-4">
          {isRegister && <div className="space-y-1.5"><Label htmlFor="name">Full name</Label><Input id="name" required /></div>}
          <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" required /></div>
          <div className="space-y-1.5"><Label htmlFor="pw">Password</Label><Input id="pw" type="password" required /></div>
          <Button type="submit" className="w-full">{isRegister ? "Create account" : "Sign in"}</Button>
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {isRegister ? <>Have an account? <Link to="/login" className="text-primary underline">Sign in</Link></> : <>New here? <Link to="/register" className="text-primary underline">Register</Link></>}
        </p>
      </form>
    </div>
  );
}
