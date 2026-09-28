import { safeAuthNext } from "@/lib/auth-redirect";
import { submitAuthForm } from "@/lib/auth-form.service";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, MailCheck, CircleAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { baseLang, useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/error-message";
import { AuthFrame, PasswordInput } from "@/components/AuthFrame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function isAuthMode(value: unknown): value is "in" | "up" | "forgot" {
  return value === "in" || value === "up" || value === "forgot";
}

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => {
    const next = safeAuthNext(s["next"]);
    const mode = s["mode"];
    return {
      ...(next ? { next } : {}),
      ...(isAuthMode(mode) ? { mode } : {}),
    };
  },
  head: () => ({
    meta: [
      { title: "Prisijungimas — GYMS.LIFE treniruočių programėlė" },
      {
        name: "description",
        content: "Prisijunk arba sukurk GYMS.LIFE paskyrą ir gauk individualų treniruočių planą.",
      },
      { property: "og:title", content: "Prisijungimas — GYMS.LIFE" },
      {
        property: "og:description",
        content: "Prisijunk prie GYMS.LIFE ir tęsk savo treniruočių planą.",
      },
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
  const { t, lang } = useI18n();
  const copy =
    baseLang(lang) === "lt"
      ? {
          confirmation:
            "Patikrink el. paštą. Jei registraciją reikia patvirtinti, ten rasi nuorodą. Tik patvirtinus prisijunk prie aplikacijos.",
          session: "Nepavyko patvirtinti prisijungimo sesijos. Bandyk prisijungti dar kartą.",
        }
      : {
          confirmation:
            "Check your email. If confirmation is required, follow the link there before signing in. You are not signed in yet.",
          session: "Your sign-in session could not be confirmed. Please try signing in again.",
        };
  const { user, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"in" | "up" | "forgot">(search.mode ?? "in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [formError, setFormError] = useState("");
  const actionLock = useRef(false);
  const navigated = useRef(false);
  const next = safeAuthNext(search.next);

  const goNext = () => {
    if (navigated.current) return;
    navigated.current = true;
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

  useEffect(() => {
    if (!actionLock.current) {
      setMode(search.mode ?? "in");
      setSent(false);
      setConfirmation(false);
      setFormError("");
    }
  }, [search.mode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setSent(false);
    setConfirmation(false);
    setFormError("");
    try {
      const result = await submitAuthForm(supabase.auth, {
        mode,
        email,
        password,
        name,
        origin: window.location.origin,
        next,
      });
      if (result === "reset-requested") {
        setSent(true);
        toast.success(t("auth.resetSent"));
        return;
      }
      if (result === "confirm-email") {
        setPassword("");
        setConfirmation(true);
        return;
      }
      let ready = false;
      for (let i = 0; i < 30; i++) {
        if (await refresh()) {
          ready = true;
          break;
        }
        if (navigated.current) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (ready) goNext();
      else {
        setFormError(copy.session);
        toast.error(copy.session);
      }
    } catch (error) {
      const message = errorMessage(error, t("common.error"));
      setFormError(message);
      toast.error(message);
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  };
  const google = async () => {
    if (actionLock.current) return;
    actionLock.current = true;
    setGoogleBusy(true);
    setFormError("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth${next ? `?next=${encodeURIComponent(next)}` : ""}`,
        },
      });
      if (error) throw error;
      // OAuth navigates away. A second attempt cannot start while leaving.
    } catch (error) {
      actionLock.current = false;
      setGoogleBusy(false);
      const message = errorMessage(error, t("common.error"));
      setFormError(message);
      toast.error(message);
    }
  };

  const title =
    mode === "in" ? t("auth.title") : mode === "up" ? t("l3.auth.title") : t("auth.resetTitle");

  return (
    <AuthFrame
      title={title}
      description={
        mode === "forgot"
          ? t("auth.resetHint")
          : mode === "up"
            ? t("l3.auth.sub")
            : baseLang(lang) === "lt"
              ? "Tavo erdvė laukia. Prisijunk ir tęsk nuo ten, kur sustojai."
              : "Your space is ready. Sign in and pick up where you left off."
      }
    >
      {confirmation && (
        <div role="status" className="fl-auth-notice">
          <MailCheck aria-hidden="true" />
          <span>{copy.confirmation}</span>
        </div>
      )}
      {formError && (
        <div role="alert" id="auth-error" className="fl-auth-notice fl-auth-error">
          <CircleAlert aria-hidden="true" />
          <span>{formError}</span>
        </div>
      )}
      <form
        onSubmit={submit}
        className="fl-auth-form"
        aria-busy={busy || googleBusy}
        aria-describedby={formError ? "auth-error" : undefined}
      >
        {mode === "up" && (
          <div className="fl-auth-field">
            <Label htmlFor="name">{t("auth.name")}</Label>
            <Input
              disabled={busy || googleBusy}
              maxLength={120}
              id="name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
        )}
        <div className="fl-auth-field">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input
            disabled={busy || googleBusy}
            maxLength={254}
            id="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setSent(false);
            }}
            required
          />
        </div>
        {mode !== "forgot" && (
          <div className="fl-auth-field">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <PasswordInput
              key={mode}
              disabled={busy || googleBusy}
              maxLength={1024}
              id="password"
              autoComplete={mode === "in" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
        )}
        {mode === "up" && <p className="fl-auth-note">{t("l3.auth.trial")}</p>}
        <Button type="submit" disabled={busy || googleBusy}>
          {busy && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
          {mode === "in"
            ? t("auth.signin")
            : mode === "up"
              ? t("auth.signup")
              : t("auth.resetSend")}
        </Button>
        {mode === "forgot" ? (
          <>
            {sent && (
              <div role="status" className="fl-auth-notice">
                <MailCheck aria-hidden="true" />
                <span>{t("auth.resetSent")}</span>
              </div>
            )}
            <button
              type="button"
              className="fl-auth-link"
              disabled={busy || googleBusy}
              onClick={() => {
                setMode("in");
                setSent(false);
                setConfirmation(false);
                setFormError("");
              }}
            >
              {t("auth.backToSignin")}
            </button>
          </>
        ) : (
          <>
            <div className="fl-auth-divider">{t("auth.or")}</div>
            <Button type="button" variant="outline" disabled={busy || googleBusy} onClick={google}>
              {googleBusy ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <GoogleIcon className="size-4" />
              )}
              <span>{t("auth.google")}</span>
            </Button>
            <button
              type="button"
              className="fl-auth-link"
              disabled={busy || googleBusy}
              onClick={() => {
                setMode(mode === "in" ? "up" : "in");
                setConfirmation(false);
                setFormError("");
              }}
            >
              {mode === "in" ? t("auth.toSignup") : t("auth.toSignin")}
            </button>
            {mode === "in" && (
              <button
                type="button"
                className="fl-auth-link"
                disabled={busy || googleBusy}
                onClick={() => {
                  setMode("forgot");
                  setFormError("");
                }}
              >
                {t("auth.forgot")}
              </button>
            )}
          </>
        )}
      </form>
    </AuthFrame>
  );
}
