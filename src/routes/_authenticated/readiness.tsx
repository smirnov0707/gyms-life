import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Activity, ChevronDown, Loader2, ShieldCheck, Moon, Heart, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { notifyAdaptationChanged } from "@/lib/readiness-adapt";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/error-message";
import { baseLang, useI18n, type Lang } from "@/lib/i18n";
import { browserTimeZone, dayInTimeZone } from "@/lib/local-day";
import { submitCheckin } from "@/lib/smart.functions";
import { calculateReadinessScore, loadModifierFor } from "@/lib/readiness.engine";

export const Route = createFileRoute("/_authenticated/readiness")({
  head: () => ({
    meta: [
      { title: "Paros pasiruošimas ir autoreguliacija — GYMS.LIFE" },
      {
        name: "description",
        content:
          "Miego, streso ir raumenų skausmo patikra, kuri automatiškai pritaiko šiandienos krūvį.",
      },
      { property: "og:title", content: "Paros pasiruošimas — GYMS.LIFE" },
      {
        property: "og:description",
        content: "Sistema perskaičiuoja šiandienos krūvį pagal tavo būklę.",
      },
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

type SurfaceCopy = {
  eyebrow: string;
  source: string;
  sourceHint: string;
  noState: string;
  noStateHint: string;
  calculated: string;
  influence: string;
  checkin: string;
  checkinHint: string;
  preview: string;
  loading: string;
  loadError: string;
  retry: string;
  draft: string;
  low: string;
  high: string;
};

function surfaceCopy(lang: Lang): SurfaceCopy {
  if (baseLang(lang) === "en") {
    return {
      eyebrow: "RECOVERY STATE",
      source: "USER-REPORTED CHECK-IN",
      sourceHint:
        "This state is calculated from the sleep, soreness, stress, energy and mood you report. Wearable physiology is not part of this score yet.",
      noState: "No recovery state recorded today",
      noStateHint:
        "Complete the short check-in below before GYMS.LIFE uses today's self-reported recovery signal.",
      calculated: "Calculated state",
      influence: "Training load modifier",
      checkin: "Update today's recovery evidence",
      checkinHint:
        "These inputs are subjective evidence. GYMS.LIFE stores them as your report, not as measured physiology.",
      preview: "Preview from current inputs",
      loading: "Loading today’s check-in…",
      loadError:
        "Today’s check-in could not be loaded. Your saved information has not been changed.",
      retry: "Try again",
      draft: "Unsaved answers · adjust each value to match how you feel today.",
      low: "Low",
      high: "High",
    };
  }

  return {
    eyebrow: "ATSISTATYMO BŪSENA",
    source: "VARTOTOJO PATEIKTA PATIKRA",
    sourceHint:
      "Ši būsena apskaičiuojama iš tavo nurodyto miego, raumenų skausmo, streso, energijos ir nuotaikos. Dėvimų įrenginių fiziologiniai signalai į šį balą kol kas neįtraukti.",
    noState: "Šiandienos atsistatymo būsena dar neužregistruota",
    noStateHint:
      "Atlik trumpą patikrą žemiau prieš GYMS.LIFE naudojant šiandienos subjektyvų atsistatymo signalą.",
    calculated: "Apskaičiuota būsena",
    influence: "Treniruočių krūvio modifikatorius",
    checkin: "Atnaujinti šiandienos atsistatymo duomenis",
    checkinHint:
      "Šie atsakymai yra subjektyvūs įrodymai. GYMS.LIFE juos saugo kaip tavo pateiktą informaciją, o ne kaip išmatuotą fiziologiją.",
    preview: "Peržiūra pagal dabartinius atsakymus",
    loading: "Kraunama šiandienos patikra…",
    loadError: "Nepavyko įkelti šiandienos patikros. Išsaugota informacija nepakeista.",
    retry: "Bandyti dar kartą",
    draft: "Neišsaugoti atsakymai · pritaikyk kiekvieną reikšmę šiandienos savijautai.",
    low: "Mažai",
    high: "Daug",
  };
}

function ReadinessPage() {
  const { t, lang } = useI18n();
  const copy = surfaceCopy(lang);
  const { user } = useAuth();
  const run = useServerFn(submitCheckin);
  const timeZone = browserTimeZone();
  const todayOn = dayInTimeZone(new Date(), timeZone);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    sleepHours: 7,
    sleepQuality: 3,
    soreness: 3,
    stress: 3,
    energy: 3,
    mood: 3,
  });

  const {
    data: today,
    refetch,
    isPending,
    isError,
    isFetching,
  } = useQuery({
    queryKey: ["checkin-today", user?.id, todayOn],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_checkins")
        .select("*")
        .eq("user_id", user!.id)
        .eq("checkin_on", todayOn)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const preview = calculateReadinessScore(form);
  const previewLoad = Math.round(loadModifierFor(preview) * 100);

  const submit = async () => {
    setBusy(true);
    try {
      await run({ data: { ...form, lang, timeZone } });
      notifyAdaptationChanged();
      await refetch();
      toast.success(t("rd.title"));
    } catch (error) {
      toast.error(errorMessage(error, t("common.error")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fl-context-route fl-workspace fl-readiness-workspace fl-page-enter">
      <section className="fl-workspace-hero fl-readiness-hero" aria-busy={isFetching}>
        <p className="fl-workspace-eyebrow">{copy.eyebrow}</p>
        <h1 className="fl-workspace-title mt-3">{t("rd.title")}</h1>
        <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-primary">
          <ShieldCheck className="size-4 shrink-0" /> {copy.source}
        </p>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {copy.sourceHint}
        </p>
        {isPending ? (
          <p
            className="fl-readiness-state flex items-center gap-3 text-sm text-muted-foreground"
            role="status"
          >
            <Loader2 className="size-5 animate-spin text-primary" /> {copy.loading}
          </p>
        ) : null}
        {isError ? (
          <div className="fl-readiness-state" role="alert">
            <p className="text-sm leading-relaxed text-foreground">{copy.loadError}</p>
            <Button
              variant="outline"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="mt-4"
            >
              <RotateCcw className="size-4" /> {copy.retry}
            </Button>
          </div>
        ) : null}
        {today ? (
          <div className="fl-readiness-state">
            <p className="fl-metric-label">{copy.calculated}</p>
            <div className="fl-readiness-metrics">
              <div>
                <p className="fl-workspace-number">
                  {today.readiness_score ?? "—"}
                  <span className="fl-metric-unit">/ 100</span>
                </p>
                <p className="fl-metric-label">{t("rd.score")}</p>
              </div>
              <div>
                <p className="fl-workspace-number">
                  {today.load_modifier == null ? "—" : `${Math.round(today.load_modifier * 100)}%`}
                </p>
                <p className="fl-metric-label">{copy.influence}</p>
              </div>
            </div>
            {today.advice ? (
              <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{today.advice}</p>
            ) : null}
          </div>
        ) : !isPending && !isError ? (
          <div className="fl-readiness-state">
            <Heart className="mb-4 size-7 text-primary" aria-hidden="true" />
            <h2 className="text-xl font-semibold tracking-tight text-foreground">{copy.noState}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{copy.noStateHint}</p>
          </div>
        ) : null}
      </section>

      {today || (!isPending && !isError) ? (
        <details open={!today} className="fl-workspace-panel fl-readiness-form group">
          <summary className="cursor-pointer list-none p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  {copy.checkin}
                </h2>
                <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                  {copy.checkinHint}
                </p>
              </div>
              <ChevronDown className="size-5 shrink-0 text-primary transition-transform group-open:rotate-180" />
            </div>
          </summary>
          <div className="border-t border-border p-5 sm:p-6">
            <p className="mb-5 text-xs leading-relaxed text-muted-foreground">{copy.draft}</p>
            <div className="fl-readiness-fields">
              <div className="fl-readiness-field fl-readiness-sleep">
                <div className="flex items-center justify-between gap-4 text-sm font-semibold text-foreground">
                  <span id="readiness-sleep-label" className="flex items-center gap-2">
                    <Moon className="size-4 text-primary" />
                    {t("rd.sleepHours")}
                  </span>
                  <span className="fl-readiness-value">{form.sleepHours} h</span>
                </div>
                <Slider
                  aria-labelledby="readiness-sleep-label"
                  aria-valuetext={`${form.sleepHours} h`}
                  min={3}
                  max={12}
                  step={0.5}
                  value={[form.sleepHours]}
                  onValueChange={([value]) =>
                    setForm((current) => ({ ...current, sleepHours: value ?? 7 }))
                  }
                />
                <div aria-hidden="true" className="fl-readiness-range">
                  <span>3 h</span>
                  <span>12 h</span>
                </div>
              </div>
              {fields.map((field) => (
                <div key={field.key} className="fl-readiness-field">
                  <div className="flex items-center justify-between gap-4 text-sm font-semibold text-foreground">
                    <span id={`readiness-${field.key}-label`}>{t(field.label)}</span>
                    <span className="fl-readiness-value">
                      {form[field.key]}
                      <span className="text-xs text-muted-foreground"> / 5</span>
                    </span>
                  </div>
                  <Slider
                    aria-labelledby={`readiness-${field.key}-label`}
                    min={1}
                    max={5}
                    step={1}
                    value={[form[field.key]]}
                    onValueChange={([value]) =>
                      setForm((current) => ({ ...current, [field.key]: value ?? 3 }))
                    }
                  />
                  <div aria-hidden="true" className="fl-readiness-range">
                    <span>1 · {copy.low}</span>
                    <span>5 · {copy.high}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="fl-readiness-submit">
              <div>
                <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <Activity className="size-4 text-primary" />
                  {copy.preview}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("rd.score")}:{" "}
                  <span className="font-semibold tabular-nums text-foreground">{preview}</span> ·{" "}
                  {t("rd.load")}:{" "}
                  <span className="font-semibold tabular-nums text-primary">{previewLoad}%</span>
                </p>
              </div>
              <Button onClick={submit} disabled={busy || isFetching}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                {today ? t("rd.again") : t("rd.submit")}
              </Button>
            </div>
          </div>
        </details>
      ) : null}
    </div>
  );
}
