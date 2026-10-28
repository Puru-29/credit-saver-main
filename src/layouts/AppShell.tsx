import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Briefcase,
  ChevronsLeft,
  FileText,
  Landmark,
  LayoutDashboard,
  Menu,
  PlusCircle,
  ScrollText,
  Shield,
  User,
  UserRound,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/new-case", label: "Create Case", icon: PlusCircle },
  { to: "/rti", label: "RTI Assistant", icon: ScrollText },
  { to: "/rights", label: "Rights Companion", icon: Shield },
  { to: "/civic-fix", label: "Civic Fix", icon: Wrench },
  { to: "/cases", label: "My Cases", icon: Briefcase },
  { to: "/documents", label: "Documents", icon: FileText },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <Link
      to="/"
      className="flex items-center gap-2 font-display text-lg font-semibold text-primary"
    >
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
        <Landmark className="h-4 w-4" />
      </span>
      {!compact && "NyaySetu"}
    </Link>
  );
}

function NavList({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon }) => {
        const active = path === to || path.startsWith(to + "/");
        return (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            title={label}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-muted",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const initials =
    user?.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || null;
  return (
    <div className="flex min-h-screen w-full">
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col overflow-y-auto border-r bg-sidebar p-3 transition-[width] md:flex print:hidden",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <div className="mb-6 flex items-center justify-between px-1 pt-1">
          <Logo compact={collapsed} />
        </div>
        <NavList collapsed={collapsed} />
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label="Toggle sidebar"
          className="mt-auto flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
        >
          <ChevronsLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
          {!collapsed && "Collapse"}
        </button>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/90 px-4 backdrop-blur print:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md p-2 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
              aria-label="Open navigation menu"
              onClick={() => setOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="md:hidden">
              <Logo />
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/notifications"
              aria-label="Notifications"
              className="rounded-lg p-2 hover:bg-muted"
            >
              <Bell className="h-4 w-4" />
            </Link>
            <Link
              to="/profile"
              aria-label={user ? `Profile: ${user.name}` : "Profile"}
              className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground"
            >
              {initials || <UserRound aria-hidden="true" className="h-4 w-4" />}
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="left-0 top-0 h-dvh w-64 max-w-[85vw] translate-x-0 translate-y-0 overflow-y-auto rounded-none bg-sidebar p-4 shadow-soft sm:rounded-none md:hidden">
          <DialogHeader className="mb-5">
            <DialogTitle>
              <Logo />
            </DialogTitle>
            <DialogDescription className="sr-only">
              Navigate to another NyaySetu page.
            </DialogDescription>
          </DialogHeader>
          <NavList onNavigate={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
