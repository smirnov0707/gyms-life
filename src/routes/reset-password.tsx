import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/error-message";
import { Logo, LangSwitch } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const { t } = useI18n();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error(t("auth.mismatch"));
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success(t("auth.updated"));
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(errorMessage(err, t("common.error")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo />
        <LangSwitch />
      </header>
      <div className="mx-auto grid max-w-md gap-6 px-4 py-10">
        <div>
          <h1 className="text-5xl">{t("auth.resetTitle")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("auth.resetHint")}</p>
        </div>
        <form onSubmit={submit} className="panel grid gap-4 p-6">
          <div className="grid gap-2">
            <Label htmlFor="pw">{t("auth.newPassword")}</Label>
            <Input
              id="pw"
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pw2">{t("auth.newPassword2")}</Label>
            <Input
              id="pw2"
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={busy} className="font-bold">
            {t("auth.updatePassword")}
          </Button>
          <Link
            to="/auth"
            className="text-center text-sm text-muted-foreground hover:text-foreground"
          >
            {t("auth.backToSignin")}
          </Link>
        </form>
      </div>
    </div>
  );
}
