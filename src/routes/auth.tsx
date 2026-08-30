import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Logo, LangSwitch } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Only same-origin relative paths are allowed as a post-login redirect. */
function safeNext(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (!value.startsWith("/") || value.startsWith("//")) return undefined;
  return value;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => {
    const next = safeNext(s['next']);
    return next ? { next } : {};
  },
  head: () => ({
    meta: [
      { title: "Prisijungimas — GYMS.LIFE treniruočių programėlė" },
      {
        name: "description",
        content: "Prisijunk arba sukurk GYMS.LIFE paskyrą ir gauk individualų treniruočių planą.",
      },
      { property: "og:title", content: "Prisijungimas — GYMS.LIFE" },
      { property: "og:description", content: "Prisijunk prie GYMS.LIFE ir tęsk savo treniruočių planą." },
    ],
  }),
  component: AuthPage,
});

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "size-4"} viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AuthPage() {
  const { t } = useI18n();
  const { user, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const search = Route.useSearch() as { next?: string };
  const next = safeNext(search.next);

  const goNext = () => {
    if (next) {
      window.location.href = next;
      return;
    }
    navigate({ to: "/app", replace: true });
  };

  useEffect(() => {
    if (!loading && user) goNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, next]);


  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSent(true);
        toast.success(t("auth.resetSent"));
        return;
      }
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${next ?? "/app"}`,
            data: { full_name: name },
          },
        });
        if (error) throw error;
      }
      // Wait until the session is actually persisted AND published to the auth context
      for (let i = 0; i < 30; i++) {
        if (await refresh()) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      goNext();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setGoogleBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth${next ? `?next=${encodeURIComponent(next)}` : ""}`,
        },
      });
      if (error) throw error;
      return;
      for (let i = 0; i < 30; i++) {
        if (await refresh()) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      goNext();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setGoogleBusy(false);
    }
  };


  const title =
    mode === "in" ? t("auth.title") : mode === "up" ? t("l3.auth.title") : t("auth.resetTitle");

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo />
        <LangSwitch />
      </header>
      <div className="mx-auto grid max-w-md gap-6 px-4 py-10">
        <div>
          <h1 className="text-5xl">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "forgot"
              ? t("auth.resetHint")
              : mode === "up"
                ? t("l3.auth.sub")
                : t("landing.sub")}
          </p>
        </div>

        <form onSubmit={submit} className="panel grid gap-4 p-6">
          {mode === "up" && (
            <div className="grid gap-2">
              <Label htmlFor="name">{t("auth.name")}</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          {mode !== "forgot" && (
            <div className="grid gap-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "in" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
          )}
          {mode === "up" && (
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {t("l3.auth.trial")}
            </p>
          )}
          <Button type="submit" disabled={busy || googleBusy} className="font-bold">
            {busy ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : null}
            {mode === "in"
              ? t("auth.signin")
              : mode === "up"
                ? t("auth.signup")
                : t("auth.resetSend")}
          </Button>

          {mode === "forgot" ? (
            <>
              {sent && <p className="text-sm text-primary">{t("auth.resetSent")}</p>}
              <button
                type="button"
                onClick={() => {
                  setMode("in");
                  setSent(false);
                }}
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                {t("auth.backToSignin")}
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 text-xs uppercase text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                {t("auth.or")}
                <span className="h-px flex-1 bg-border" />
              </div>

              <Button
                type="button"
                variant="outline"
                disabled={busy || googleBusy}
                onClick={google}
                className="flex items-center justify-center gap-2.5 h-11 font-semibold rounded-xl bg-surface hover:bg-surface-2 border-border"
              >
                {googleBusy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <GoogleIcon className="size-4.5" />
                )}
                <span>{t("auth.google")}</span>
              </Button>

              <button
                type="button"
                onClick={() => setMode(mode === "in" ? "up" : "in")}
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                {mode === "in" ? t("auth.toSignup") : t("auth.toSignin")}
              </button>

              {mode === "in" && (
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  {t("auth.forgot")}
                </button>
              )}
            </>
          )}
        </form>

        <Link to="/" className="text-center text-sm text-muted-foreground hover:text-foreground">
          {t("rt.backToHome")}
        </Link>
      </div>
    </div>
  );
}
