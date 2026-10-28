import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  LockKeyhole,
  Mail,
  PencilLine,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/common";
import { useAuth } from "@/contexts/useAuth";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({
    meta: [
      { title: "Profile — NyaySetu" },
      { name: "description", content: "Your account details and security." },
      { property: "og:title", content: "Profile — NyaySetu" },
      { property: "og:description", content: "Your account details and security." },
    ],
  }),
  component: ProfilePage,
});

function initialsFor(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf())) return "Not provided";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(date);
}

function ProfilePage() {
  const { token, user, sessionReady, refreshUser, saveName } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!sessionReady) return;
    if (!token) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setLoadError(null);
    refreshUser()
      .then((currentUser) => {
        if (active) setName(currentUser.name);
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(error instanceof Error ? error.message : "Could not load your profile.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [sessionReady, token, refreshUser]);

  function startEditing() {
    setName(user?.name ?? "");
    setNameError(null);
    setSaveError(null);
    setEditing(true);
  }

  function cancelEditing() {
    setName(user?.name ?? "");
    setNameError(null);
    setSaveError(null);
    setEditing(false);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = name.trim();
    if (normalizedName.length < 2 || normalizedName.length > 100) {
      setNameError("Name must be between 2 and 100 characters.");
      return;
    }

    setSaving(true);
    setNameError(null);
    setSaveError(null);
    try {
      await saveName(normalizedName);
      setEditing(false);
      toast.success("Profile updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save your profile.";
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (!sessionReady || loading) {
    return (
      <>
        <PageHeader title="Profile" description="Your account details and security." />
        <Card>
          <CardContent className="p-2">
            <LoadingState label="Loading your account profile…" />
          </CardContent>
        </Card>
      </>
    );
  }

  if (!token) {
    return (
      <>
        <PageHeader title="Profile" description="Your account details and security." />
        <EmptyState
          title="Sign in to view your profile"
          description="Your profile is loaded from your authenticated NyaySetu account."
          action={
            <Button asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Profile"
        description="Review and manage the account information supported by NyaySetu."
      />

      {loadError ? (
        <div className="space-y-3">
          <ErrorState message={loadError} />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setLoading(true);
              setLoadError(null);
              void refreshUser()
                .then((currentUser) => setName(currentUser.name))
                .catch((error: unknown) =>
                  setLoadError(
                    error instanceof Error ? error.message : "Could not load your profile.",
                  ),
                )
                .finally(() => setLoading(false));
            }}
          >
            Try again
          </Button>
        </div>
      ) : !user ? (
        <ErrorState message="The API did not return an authenticated user profile." />
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div className="flex min-w-0 items-center gap-4">
                <div
                  aria-label={`${user.name} initials`}
                  className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-primary text-lg font-semibold text-primary-foreground"
                >
                  {initialsFor(user.name)}
                </div>
                <div className="min-w-0">
                  <CardTitle className="truncate text-xl">{user.name}</CardTitle>
                  <CardDescription className="mt-1 break-all">{user.email}</CardDescription>
                </div>
              </div>
              {!editing && (
                <Button type="button" variant="outline" onClick={startEditing}>
                  <PencilLine aria-hidden="true" />
                  Edit profile
                </Button>
              )}
            </CardHeader>
            <CardContent className="grid gap-4 border-t pt-5 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <CalendarDays aria-hidden="true" className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">Account created</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatCreatedAt(user.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">Account status</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Not provided by the account API
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {editing && (
            <Card>
              <CardHeader>
                <CardTitle>Edit profile</CardTitle>
                <CardDescription>
                  Update the name associated with your authenticated account.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="max-w-xl space-y-4" onSubmit={handleSave} noValidate>
                  <div className="space-y-2">
                    <Label htmlFor="profile-name">Full name</Label>
                    <Input
                      id="profile-name"
                      autoComplete="name"
                      value={name}
                      maxLength={100}
                      aria-invalid={Boolean(nameError)}
                      aria-describedby={nameError ? "profile-name-error" : undefined}
                      onChange={(event) => {
                        setName(event.target.value);
                        setNameError(null);
                      }}
                    />
                    {nameError && (
                      <p id="profile-name-error" role="alert" className="text-sm text-destructive">
                        {nameError}
                      </p>
                    )}
                  </div>
                  {saveError && <ErrorState message={saveError} />}
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={saving}>
                      {saving ? "Saving…" : "Save Changes"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={saving}
                      onClick={cancelEditing}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LockKeyhole aria-hidden="true" className="h-4 w-4 text-primary" />
                  Account security
                </CardTitle>
                <CardDescription>
                  Manage the identity and access details for this account.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-start gap-3">
                  <Mail aria-hidden="true" className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Email address</p>
                    <p className="mt-1 break-all text-sm text-muted-foreground">{user.email}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Email changes are not supported by the backend.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <UserRound aria-hidden="true" className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Password</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Password changes are not supported yet. No password is stored or changed here.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-primary" />
                  Account preferences
                </CardTitle>
                <CardDescription>
                  Preferences are shown only when the account API can persist them.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-3 rounded-lg border border-dashed p-4">
                  <AlertCircle
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 text-muted-foreground"
                  />
                  <p className="text-sm text-muted-foreground">
                    Notification and accessibility preferences are not currently stored by this
                    account API, so there are no non-persistent switches on this page.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
