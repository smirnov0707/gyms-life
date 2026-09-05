import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, ChevronDown, History, Trophy } from "lucide-react";
import { BodyCompositionScanner } from "@/components/BodyCompositionScanner";
import { BodyMetricsPanel } from "@/components/BodyMetricsPanel";
import { InjuryRiskRadar } from "@/components/InjuryRiskRadar";
import { PerformanceProgressPanel } from "@/components/PerformanceProgressPanel";
import { ProgressForecast } from "@/components/ProgressForecast";
import { WeeklyIntelligenceReview } from "@/components/WeeklyIntelligenceReview";
import { WorkoutReportExporter } from "@/components/WorkoutReportExporter";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { baseLang, formatLocale, useI18n, type Lang } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({
    meta: [
      { title: "Progresas ir rekordai — GYMS.LIFE" },
      {
        name: "description",
        content: "Savaitės tūris, kūno svorio kreivė ir asmeniniai rekordai.",
      },
      { property: "og:title", content: "Progresas — GYMS.LIFE" },
      {
        property: "og:description",
        content: "Sek savo treniruočių tūrį, svorį ir asmeninius rekordus.",
      },
    ],
  }),
  component: ProgressPage,
});

type Copy = {
  eyebrow: string;
  title: string;
  subtitle: string;
  intelligence: string;
  intelligenceHint: string;
  measured: string;
  measuredHint: string;
  records: string;
  recordsHint: string;
  history: string;
  historyHint: string;
  tools: string;
  toolsHint: string;
};

function copyFor(lang: Lang): Copy {
  if (baseLang(lang) === "en") {
    return {
      eyebrow: "TWIN EVOLUTION",
      title: "How you are changing",
      subtitle:
        "GYMS.LIFE separates interpretation from raw history so you can see what changed before inspecting every measurement.",
      intelligence: "What the system sees changing",
      intelligenceHint: "Performance, weekly patterns, forecast and current risk observations.",
      measured: "Inspect measured training history",
      measuredHint:
        "Completed-session volume over time. This is recorded history, not a prediction.",
      records: "Personal records",
      recordsHint: "Highest recorded working weights by exercise.",
      history: "Workout timeline",
      historyHint: "Completed sessions in reverse chronological order.",
      tools: "Body & reporting tools",
      toolsHint: "Body measurements, optional body capture and export tools.",
    };
  }

  return {
    eyebrow: "TWIN EVOLIUCIJA",
    title: "Kaip tu keitiesi",
    subtitle:
      "GYMS.LIFE atskiria interpretaciją nuo žalios istorijos, kad pirmiausia matytum, kas pasikeitė, o tik tada visus matavimus.",
    intelligence: "Ką sistema mato besikeičiant",
    intelligenceHint:
      "Performance, savaitiniai dėsningumai, prognozė ir dabartiniai rizikos stebėjimai.",
    measured: "Peržiūrėti išmatuotą treniruočių istoriją",
    measuredHint: "Užbaigtų treniruočių tūris laike. Tai užregistruota istorija, ne prognozė.",
    records: "Asmeniniai rekordai",
    recordsHint: "Didžiausi užregistruoti darbiniai svoriai pagal pratimą.",
    history: "Treniruočių laiko juosta",
    historyHint: "Užbaigtos treniruotės nuo naujausios iki seniausios.",
    tools: "Kūno ir ataskaitų įrankiai",
    toolsHint: "Kūno matavimai, pasirenkamas kūno fiksavimas ir eksporto įrankiai.",
  };
}

function ProgressPage() {
  const { lang, t } = useI18n();
  const copy = copyFor(lang);
  const { user } = useAuth();

  const { data: sessions } = useQuery({
    queryKey: ["sessions-all", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("workout_sessions")
        .select("id, title, started_at, total_volume, duration_seconds")
        .eq("user_id", user!.id)
        .not("finished_at", "is", null)
        .order("started_at", { ascending: true });
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: records } = useQuery({
    queryKey: ["records", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("set_logs")
        .select("exercise_name, exercise_slug, weight_kg, reps")
        .eq("user_id", user!.id)
        .not("weight_kg", "is", null)
        .order("weight_kg", { ascending: false })
        .limit(200);
      const best: Record<string, { name: string; weight: number; reps: number }> = {};
      for (const row of data ?? []) {
        const weight = Number(row.weight_kg);
        if (!best[row.exercise_slug] || weight > best[row.exercise_slug]!.weight) {
          best[row.exercise_slug] = {
            name: row.exercise_name,
            weight,
            reps: Number(row.reps ?? 0),
          };
        }
      }
      return Object.values(best)
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 8);
    },
    enabled: !!user,
  });

  const volumeData = (sessions ?? []).map((session) => ({
    date: new Date(session.started_at).toLocaleDateString(formatLocale(lang), {
      month: "2-digit",
      day: "2-digit",
    }),
    volume: Math.round(Number(session.total_volume ?? 0)),
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/[0.07] bg-[#050706] p-5 sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(70% 120% at 0% 0%, rgba(16,185,129,.10), transparent 62%)",
          }}
        />
        <div className="relative">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-400">
            {copy.eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {t("pr.title")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-500">{copy.subtitle}</p>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/[0.07] bg-white/[0.02] p-4 sm:p-6">
        <div className="mb-5">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">
            <Activity className="size-4" /> {copy.intelligence}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-600">{copy.intelligenceHint}</p>
        </div>
        <div className="space-y-4">
          <PerformanceProgressPanel />
          <WeeklyIntelligenceReview />
          <ProgressForecast />
          <InjuryRiskRadar />
        </div>
      </section>

      <details className="group rounded-[1.75rem] border border-white/[0.07] bg-white/[0.015]">
        <summary className="cursor-pointer list-none px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">{t("pr.volume")}</p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-600">{copy.measuredHint}</p>
            </div>
            <ChevronDown className="size-4 shrink-0 text-neutral-600 transition-transform group-open:rotate-180" />
          </div>
        </summary>
        <div className="border-t border-white/[0.06] p-5 sm:p-6">
          {volumeData.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volumeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      color: "var(--foreground)",
                    }}
                  />
                  <Bar dataKey="volume" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">{t("pr.empty")}</p>
          )}
        </div>
      </details>

      <details className="group rounded-[1.75rem] border border-white/[0.07] bg-white/[0.015]">
        <summary className="cursor-pointer list-none px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-white">
                <Trophy className="size-4 text-emerald-400" /> {t("pr.records")}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-600">{copy.recordsHint}</p>
            </div>
            <ChevronDown className="size-4 shrink-0 text-neutral-600 transition-transform group-open:rotate-180" />
          </div>
        </summary>
        <div className="border-t border-white/[0.06] px-5 py-2 sm:px-6">
          {records?.length ? (
            <div className="divide-y divide-white/[0.06]">
              {records.map((record) => (
                <div key={record.name} className="flex items-center justify-between gap-4 py-4">
                  <span className="text-sm font-medium text-neutral-300">{record.name}</span>
                  <span className="font-mono text-sm text-white">
                    {record.weight} kg × {record.reps}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-sm text-neutral-500">{t("pr.empty")}</p>
          )}
        </div>
      </details>

      <details className="group rounded-[1.75rem] border border-white/[0.07] bg-white/[0.015]">
        <summary className="cursor-pointer list-none px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-white">
                <History className="size-4 text-emerald-400" /> {t("pr.history")}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-600">{copy.historyHint}</p>
            </div>
            <ChevronDown className="size-4 shrink-0 text-neutral-600 transition-transform group-open:rotate-180" />
          </div>
        </summary>
        <div className="border-t border-white/[0.06] px-5 py-2 sm:px-6">
          <div className="divide-y divide-white/[0.06]">
            {[...(sessions ?? [])].reverse().map((session) => (
              <div
                key={session.id}
                className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-sm font-medium text-neutral-300">{session.title}</span>
                <span className="font-mono text-[10px] text-neutral-600">
                  {new Date(session.started_at).toLocaleDateString(formatLocale(lang))} ·{" "}
                  {Math.round(Number(session.total_volume ?? 0))} kg ·{" "}
                  {Math.round((session.duration_seconds ?? 0) / 60)} min
                </span>
              </div>
            ))}
            {!sessions?.length ? (
              <p className="py-4 text-sm text-neutral-500">{t("pr.empty")}</p>
            ) : null}
          </div>
        </div>
      </details>

      <details className="group rounded-[1.75rem] border border-white/[0.07] bg-white/[0.015]">
        <summary className="cursor-pointer list-none px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">{copy.tools}</p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-600">{copy.toolsHint}</p>
            </div>
            <ChevronDown className="size-4 shrink-0 text-neutral-600 transition-transform group-open:rotate-180" />
          </div>
        </summary>
        <div className="space-y-5 border-t border-white/[0.06] p-5 sm:p-6">
          <BodyMetricsPanel />
          <BodyCompositionScanner />
          <WorkoutReportExporter />
        </div>
      </details>
    </div>
  );
}
