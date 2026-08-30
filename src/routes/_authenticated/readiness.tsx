import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Activity, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { submitCheckin, readinessScore, loadModifier } from "@/lib/smart.functions";
import { useAuth } from "@/lib/auth";
import { useI18n, baseLang, type TKey } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export const Route = createFileRoute("/_authenticated/readiness")({
  head: () => ({
    meta: [
      { title: "Paros pasiruošimas ir autoreguliacija — GYMS.LIFE" },
      {
        name: "description",
        content: "Miego, streso ir raumenų skausmo patikra, kuri automatiškai pritaiko šiandienos krūvį.",
      },
      { property: "og:title", content: "Paros pasiruošimas — GYMS.LIFE" },
      { property: "og:description", content: "Sistema perskaičiuoja šiandienos krūvį pagal tavo būklę." },
    ],
  }),
  component: ReadinessPage,
});

const fields = [
  { key: "sleepQuality", label: "rd.sleepQuality" },
  { key: "soreness", label: "rd.soreness" },
  { key: "stress", label: "rd.stress" },
  { key: "energy", label: "rd.energy" },
  { key: "mood", label: "rd.mood" },
] as const;

function ReadinessPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const run = useServerFn(submitCheckin);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    sleepHours: 7,
    sleepQuality: 3,
    soreness: 3,
    stress: 3,
    energy: 3,
    mood: 3,
  });

  const { data: today, refetch } = useQuery({
    queryKey: ["checkin-today", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_checkins")
        .select("*")
        .eq("user_id", user!.id)
        .eq("checkin_on", new Date().toISOString().slice(0, 10))
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const preview = readinessScore({ ...form, lang: baseLang(lang) });
  const previewLoad = Math.round(loadModifier(preview) * 100);

  const submit = async () => {
    setBusy(true);
    try {
      await run({ data: { ...form, lang } });
      await refetch();
      toast.success(t("rd.title"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-primary">AUTOREGULATION</p>
        <h1 className="text-5xl">{t("rd.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("rd.sub")}</p>
      </div>

      {today && (
        <div className="panel grid gap-3 p-6 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="text-center">
            <div className="text-display text-6xl leading-none text-primary">
              {today.readiness_score}
            </div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{t("rd.score")}</p>
            <p className="mt-1 text-sm font-bold text-accent">
              {t("rd.load")}: {Math.round(Number(today.load_modifier ?? 1) * 100)}%
            </p>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{today.advice}</p>
        </div>
      )}

      <div className="panel grid gap-6 p-6">
        <div>
          <div className="flex justify-between text-sm font-semibold">
            <span>{t("rd.sleepHours")}</span>
            <span className="text-primary">{form.sleepHours} h</span>
          </div>
          <Slider
            className="mt-3"
            min={3}
            max={12}
            step={0.5}
            value={[form.sleepHours]}
            onValueChange={([v]) => setForm((f) => ({ ...f, sleepHours: v ?? 7 }))}
          />
        </div>

        {fields.map((f) => (
          <div key={f.key}>
            <div className="flex justify-between text-sm font-semibold">
              <span>{t(f.label as TKey)}</span>
              <span className="text-primary">{form[f.key]}/5</span>
            </div>
            <Slider
              className="mt-3"
              min={1}
              max={5}
              step={1}
              value={[form[f.key]]}
              onValueChange={([v]) => setForm((prev) => ({ ...prev, [f.key]: v ?? 3 }))}
            />
          </div>
        ))}

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
          <div className="flex items-center gap-3 text-sm">
            <Activity className="size-5 text-primary" />
            <span>
              {t("rd.score")}: <b className="text-primary">{preview}</b> · {t("rd.load")}:{" "}
              <b className="text-accent">{previewLoad}%</b>
            </span>
          </div>
          <Button onClick={submit} disabled={busy} className="rounded-full px-6 font-bold glow-ring">
            {busy && <Loader2 className="mr-1 size-4 animate-spin" />}
            {today ? t("rd.again") : t("rd.submit")}
          </Button>
        </div>
      </div>
    </div>
  );
}
