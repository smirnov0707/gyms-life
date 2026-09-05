import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ChevronDown, Flame, Loader2, ScanLine, Sparkles, Trash2, Utensils } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DineOutMenuScanner } from "@/components/DineOutMenuScanner";
import { Input } from "@/components/ui/input";
import { QuickHydrationWidget } from "@/components/QuickHydrationWidget";
import { SmartFridgeScanner } from "@/components/SmartFridgeScanner";
import { VisionMealScanner } from "@/components/VisionMealScanner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/error-message";
import { baseLang, useI18n, type Lang } from "@/lib/i18n";
import { browserTimeZone, dayInTimeZone } from "@/lib/local-day";
import { logMeal } from "@/lib/nutrition.functions";
import { resolveNutritionTargets, type NutritionTargets } from "@/lib/nutrition-targets.engine";

export const Route = createFileRoute("/_authenticated/nutrition")({
  head: () => ({
    meta: [
      { title: "Mitybos dienoraštis — GYMS.LIFE" },
      {
        name: "description",
        content:
          "Aprašyk patiekalą paprastais žodžiais — suskaičiuosime kalorijas, baltymus, angliavandenius ir riebalus bei suderins su treniruočių tikslu.",
      },
      { property: "og:title", content: "Mitybos dienoraštis — GYMS.LIFE" },
      { property: "og:description", content: "Kalorijos ir makro elementai iš vieno sakinio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NutritionPage,
});

type Row = Tables<"nutrition_logs">;

type SurfaceCopy = {
  eyebrow: string;
  state: string;
  stateHint: string;
  logAction: string;
  history: string;
  historyHint: string;
  tools: string;
  toolsHint: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
};

function surfaceCopy(lang: Lang): SurfaceCopy {
  if (baseLang(lang) === "en") {
    return {
      eyebrow: "NUTRITION STATE",
      state: "Today's intake",
      stateHint: "Measured from the meals you have actually logged today.",
      logAction: "Log what you ate",
      history: "Inspect today's food log",
      historyHint: "Every item currently contributing to today's measured intake.",
      tools: "Capture tools",
      toolsHint: "Use camera and context tools when typing is not the fastest option.",
      kcal: "Energy",
      protein: "Protein",
      carbs: "Carbs",
      fat: "Fat",
    };
  }

  return {
    eyebrow: "MITYBOS BŪSENA",
    state: "Šiandienos suvartojimas",
    stateHint: "Apskaičiuota tik iš maisto, kurį šiandien realiai užregistravai.",
    logAction: "Užregistruok, ką suvalgei",
    history: "Peržiūrėti šiandienos maisto įrašus",
    historyHint: "Visi įrašai, kurie šiuo metu sudaro šiandienos suvartojimą.",
    tools: "Fiksavimo įrankiai",
    toolsHint: "Naudok kamerą ir kontekstinius įrankius, kai rašyti nėra greičiausias būdas.",
    kcal: "Energija",
    protein: "Baltymai",
    carbs: "Angliavandeniai",
    fat: "Riebalai",
  };
}

function Metric({
  value,
  target,
  label,
  unit,
}: {
  value: number;
  target: number | null;
  label: string;
  unit: string;
}) {
  const pct =
    target === null ? null : Math.min(100, Math.round((value / Math.max(1, target)) * 100));

  return (
    <div className="border-b border-white/[0.06] py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:px-4 sm:py-0 sm:last:border-r-0">
      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-neutral-600">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="font-mono text-2xl text-white">
          {Math.round(value)}
          {unit}
        </p>
        {target === null ? null : (
          <span className="font-mono text-xs text-neutral-600">
            / {Math.round(target)}
            {unit}
          </span>
        )}
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-emerald-400/70 transition-[width]"
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>
      <p className="mt-2 font-mono text-[10px] text-neutral-600">
        {pct === null ? "—" : `${pct}%`}
      </p>
    </div>
  );
}

function targetsNote(targets: NutritionTargets, lang: Lang): string {
  const en = baseLang(lang) === "en";
  if (targets.basis === "meal_plan") {
    return en ? "Targets from your active meal plan." : "Tikslai iš tavo aktyvaus mitybos plano.";
  }
  if (targets.basis === "estimated") {
    return en
      ? "Estimated from your body weight and goal. Generate a meal plan for targets built around your food."
      : "Įvertinta pagal tavo svorį ir tikslą. Susikurk mitybos planą, kad tikslai būtų pritaikyti tavo maistui.";
  }
  return en
    ? "No targets yet — add your body weight or generate a meal plan."
    : "Tikslų kol kas nėra — įvesk savo svorį arba susikurk mitybos planą.";
}

function NutritionPage() {
  const { t, lang } = useI18n();
  const copy = surfaceCopy(lang);
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const call = useServerFn(logMeal);
  const timeZone = browserTimeZone();
  const today = dayInTimeZone(new Date(), timeZone);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select(
          "id, display_name, locale, birth_year, gender, height_cm, weight_kg, target_weight_kg, experience, goal, location, days_per_week, session_minutes, equipment, limitations, onboarded, created_at, updated_at, diet, allergies, dislikes, meals_per_day",
        )
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: activePlan } = useQuery({
    queryKey: ["meal-plan-targets", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("meal_plans")
        .select("kcal_target, protein_target, fat_target, carbs_target")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: logs } = useQuery({
    queryKey: ["nutrition", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nutrition_logs")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) throw new Error(`Could not load nutrition logs: ${error.message}`);
      return data ?? [];
    },
    enabled: !!user,
  });

  const add = useMutation({
    mutationFn: async () => call({ data: { description: text, lang, timeZone } }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["nutrition", user?.id] });
    },
    onError: (error) => toast.error(errorMessage(error, t("common.error"))),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("nutrition_logs").delete().eq("id", id);
      if (error) throw new Error(`Could not delete meal log: ${error.message}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nutrition", user?.id] }),
    onError: (error) => toast.error(errorMessage(error, t("common.error"))),
  });

  const todays = (logs ?? []).filter((log) => log.logged_on === today);
  const sum = (key: keyof Row) => todays.reduce((total, log) => total + Number(log[key] ?? 0), 0);

  const targets = resolveNutritionTargets({
    planKcal: activePlan?.kcal_target ?? null,
    planProteinG: activePlan?.protein_target ?? null,
    planFatG: activePlan?.fat_target ?? null,
    planCarbsG: activePlan?.carbs_target ?? null,
    bodyWeightKg: profile?.weight_kg == null ? null : Number(profile.weight_kg),
    goal: profile?.goal ?? null,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/[0.07] bg-[#050706] p-5 sm:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(70% 120% at 0% 0%, rgba(16,185,129,.10), transparent 62%)",
          }}
        />
        <div className="relative">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-400">
            {copy.eyebrow} · {t("nut.today")}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {copy.state}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-500">
            {copy.stateHint}
          </p>

          <div className="mt-7 grid sm:grid-cols-4">
            <Metric
              value={sum("calories")}
              target={targets.kcal}
              label={copy.kcal}
              unit={t("nut.kcal")}
            />
            <Metric
              value={sum("protein")}
              target={targets.proteinG}
              label={copy.protein}
              unit="g"
            />
            <Metric value={sum("carbs")} target={targets.carbsG} label={copy.carbs} unit="g" />
            <Metric value={sum("fat")} target={targets.fatG} label={copy.fat} unit="g" />
          </div>

          <p className="mt-5 border-t border-white/[0.06] pt-4 text-xs leading-relaxed text-neutral-600">
            {targetsNote(targets, lang)}
          </p>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/[0.07] bg-white/[0.02] p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Utensils className="size-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-white">{copy.logAction}</h2>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={t("nut.ph")}
            onKeyDown={(event) => {
              if (event.key === "Enter" && text.trim().length > 1) add.mutate();
            }}
            className="h-12 flex-1 border-white/[0.08] bg-white/[0.025]"
          />
          <Button
            size="lg"
            className="h-12 rounded-full px-7 font-bold"
            disabled={add.isPending || text.trim().length < 2}
            onClick={() => add.mutate()}
          >
            {add.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 size-4" />
            )}
            {add.isPending ? t("nut.analyzing") : t("nut.add")}
          </Button>
        </div>
      </section>

      <QuickHydrationWidget />

      <details className="group rounded-[1.75rem] border border-white/[0.07] bg-white/[0.015]">
        <summary className="cursor-pointer list-none px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">{copy.history}</p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-600">{copy.historyHint}</p>
            </div>
            <ChevronDown className="size-4 shrink-0 text-neutral-600 transition-transform group-open:rotate-180" />
          </div>
        </summary>
        <div className="border-t border-white/[0.06] px-5 py-2 sm:px-6">
          {todays.length === 0 ? (
            <p className="py-4 text-sm text-neutral-500">{t("nut.empty")}</p>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {todays.map((log) => (
                <li key={log.id} className="flex items-start gap-3 py-4">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-white/[0.06] text-emerald-400">
                    <Flame className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-200">{log.food_name}</p>
                    <p className="mt-1 font-mono text-[10px] leading-relaxed text-neutral-600">
                      {log.calories} kcal · {log.protein}g P · {log.carbs}g C · {log.fat}g F
                    </p>
                    {log.note ? (
                      <p className="mt-1 text-xs leading-relaxed text-neutral-500">{log.note}</p>
                    ) : null}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove.mutate(log.id)}
                    title={t("nut.delete")}
                    className="text-neutral-600 hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>

      <details className="group rounded-[1.75rem] border border-white/[0.07] bg-white/[0.015]">
        <summary className="cursor-pointer list-none px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-white">
                <ScanLine className="size-4 text-emerald-400" /> {copy.tools}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-600">{copy.toolsHint}</p>
            </div>
            <ChevronDown className="size-4 shrink-0 text-neutral-600 transition-transform group-open:rotate-180" />
          </div>
        </summary>
        <div className="space-y-6 border-t border-white/[0.06] p-5 sm:p-6">
          <SmartFridgeScanner />
          <VisionMealScanner />
          <DineOutMenuScanner />
        </div>
      </details>
    </div>
  );
}
