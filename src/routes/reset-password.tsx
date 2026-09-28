import { useAuth } from "@/lib/auth";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { baseLang, useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/error-message";
import { AuthFrame, PasswordInput } from "@/components/AuthFrame";
import { Loader2, KeyRound, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Naujas slaptažodis — GYMS.LIFE" },
      {
        name: "description",
        content: "Susikurk naują GYMS.LIFE paskyros slaptažodį ir tęsk savo treniruočių planą.",
      },
      { property: "og:title", content: "Naujas slaptažodis — GYMS.LIFE" },
      {
        property: "og:description",
        content: "Atkurk prieigą prie savo GYMS.LIFE treniruočių plano.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { t, lang } = useI18n();
  const { user, loading } = useAuth();
  const lock = useRef(false);
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lock.current || loading || !user) return;
    setFormError("");
    if (password !== confirm) {
      setFormError(t("auth.mismatch"));
      toast.error(t("auth.mismatch"));
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      if (!data.user) throw new Error("Password change could not be confirmed");
      toast.success(t("auth.updated"));
      navigate({ to: "/app" });
    } catch (err) {
      const message = errorMessage(err, t("common.error"));
      setFormError(message);
      toast.error(message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <AuthFrame
      title={t("auth.resetTitle")}
      description={
        baseLang(lang) === "lt"
          ? "Atkurk prieigą prie savo erdvės. Pasirink naują slaptažodį."
          : "Return to your space. Choose a new password for your account."
      }
    >
      {loading ? (
        <div role="status" className="fl-auth-notice">
          <Loader2 aria-hidden="true" className="animate-spin" />
          {t("common.loading")}
        </div>
      ) : !user ? (
        <div className="fl-auth-form">
          <section role="alert" className="fl-auth-notice">
            <KeyRound aria-hidden="true" />
            <p>
              {baseLang(lang) === "lt"
                ? "Atidaryk slaptažodžio atkūrimo nuorodą iš el. laiško. Ši nuoroda gali būti pasibaigusi arba nenaudota šiame įrenginyje."
                : "Open the password recovery link from your email. Your link may be missing or expired on this device."}
            </p>
          </section>
          <Button asChild>
            <Link to="/auth" search={{ mode: "forgot" }}>
              {t("auth.resetSend")}
            </Link>
          </Button>
        </div>
      ) : (
        <>
          {formError && (
            <div role="alert" id="reset-error" className="fl-auth-notice fl-auth-error">
              <CircleAlert aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}
          <form
            onSubmit={submit}
            className="fl-auth-form"
            aria-busy={busy}
            aria-describedby={formError ? "reset-error" : undefined}
          >
            <div className="fl-auth-field">
              <Label htmlFor="pw">{t("auth.newPassword")}</Label>
              <PasswordInput
                id="pw"
                autoComplete="new-password"
                disabled={busy}
                maxLength={1024}
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="fl-auth-field">
              <Label htmlFor="pw2">{t("auth.newPassword2")}</Label>
              <PasswordInput
                id="pw2"
                autoComplete="new-password"
                disabled={busy}
                maxLength={1024}
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
              {t("auth.updatePassword")}
            </Button>
            <Link to="/auth" className="fl-auth-link">
              {t("auth.backToSignin")}
            </Link>
          </form>
        </>
      )}
    </AuthFrame>
  );
}
