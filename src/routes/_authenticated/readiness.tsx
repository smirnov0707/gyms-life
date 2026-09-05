import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Activity, ChevronDown, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { applyAdaptation } from "@/lib/readiness-adapt";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/error-message";
import { baseLang, useI18n, type Lang, type TKey } from "@/lib/i18n";
import { browserTimeZone, dayInTimeZone } from "@/lib/local-day";
import { submitCheckin, readinessScore, loadModifier } from "@/lib/smart.functions";

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

  const { data: today, refetch } = useQuery({
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

  const preview = readinessScore(form);
  const previewLoad = Math.round(loadModifier(preview) * 100);

  const submit = async () => {
    setBusy(true);
    try {
      const result = await run({ data: { ...form, lang, timeZone } });
      applyAdaptation(result.modifier);
      await refetch();
      toast.success(t("rd.title"));
    } catch (error) {
      toast.error(errorMessage(error, t("common.error")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/[0.07] bg-[#050706] p-5 sm:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(70% 120% at 0% 0%, rgba(16,185,129,.10), transparent 62%)",
          }}
        />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-400">
              {copy.eyebrow}
            </p>
            <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-neutral-600">
              {copy.source}
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {t("rd.title")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-500">
            {copy.sourceHint}
          </p>

          {today ? (
            <div className="mt-7 grid gap-6 border-t border-white/[0.06] pt-6 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-neutral-600">
                  <ShieldCheck className="size-3.5 text-emerald-400" /> {copy.calculated}
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-4">
                  <div>
                    <p className="font-mono text-5xl leading-none text-white">
                      {today.readiness_score}
                    </p>
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-600">
                      {t("rd.score")} / 100
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-2xl text-emerald-400">
                      {Math.round(Number(today.load_modifier ?? 1) * 100)}%
                    </p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-600">
                      {copy.influence}
                    </p>
                  </div>
                </div>
                <p className="mt-5 max-w-2xl text-sm leading-relaxed text-neutral-400">
                  {today.advice}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-7 border-t border-white/[0.06] pt-6">
              <p className="text-lg font-medium text-white">{copy.noState}</p>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-neutral-500">
                {copy.noStateHint}
              </p>
            </div>
          )}
        </div>
      </section>

      <details
        open={!today}
        className="group rounded-[1.75rem] border border-border bg-foreground/[0.02]"
      >
        <summary className="cursor-pointer list-none px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-foreground">{copy.checkin}</p>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                {copy.checkinHint}
              </p>
            </div>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </div>
        </summary>

        <div className="grid gap-6 border-t border-border p-5 sm:p-6">
          <div>
            <div className="flex justify-between gap-4 text-sm font-medium text-foreground">
              <span>{t("rd.sleepHours")}</span>
              <span className="font-mono text-emerald-400 light:text-emerald-700">
                {form.sleepHours} h
              </span>
            </div>
            <Slider
              className="mt-3"
              min={3}
              max={12}
              step={0.5}
              value={[form.sleepHours]}
              onValueChange={([value]) =>
                setForm((current) => ({ ...current, sleepHours: value ?? 7 }))
              }
            />
          </div>

          {fields.map((field) => (
            <div key={field.key}>
              <div className="flex justify-between gap-4 text-sm font-medium text-foreground">
                <span>{t(field.label as TKey)}</span>
                <span className="font-mono text-emerald-400 light:text-emerald-700">
                  {form[field.key]}/5
                </span>
              </div>
              <Slider
                className="mt-3"
                min={1}
                max={5}
                step={1}
                value={[form[field.key]]}
                onValueChange={([value]) =>
                  setForm((current) => ({ ...current, [field.key]: value ?? 3 }))
                }
              />
            </div>
          ))}

          <div className="flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                <Activity className="size-3.5 text-emerald-400 light:text-emerald-700" />{" "}
                {copy.preview}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("rd.score")}: <span className="font-mono text-foreground">{preview}</span> ·{" "}
                {t("rd.load")}:{" "}
                <span className="font-mono text-emerald-400 light:text-emerald-700">
                  {previewLoad}%
                </span>
              </p>
            </div>
            <Button onClick={submit} disabled={busy} className="rounded-full px-6 font-bold">
              {busy ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
              {today ? t("rd.again") : t("rd.submit")}
            </Button>
          </div>
        </div>
      </details>
    </div>
  );
}
