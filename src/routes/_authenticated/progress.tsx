import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { WorkoutReportExporter } from "@/components/WorkoutReportExporter";
import { BodyCompositionScanner } from "@/components/BodyCompositionScanner";
import { BodyMetricsPanel } from "@/components/BodyMetricsPanel";
import { ProgressForecast } from "@/components/ProgressForecast";
import { InjuryRiskRadar } from "@/components/InjuryRiskRadar";
import { PerformanceProgressPanel } from "@/components/PerformanceProgressPanel";
import { AIProgressInsights } from "@/components/AIProgressInsights";
import { WeeklyIntelligenceReview } from "@/components/WeeklyIntelligenceReview";

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

function ProgressPage() {
  const { t } = useI18n();
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
      for (const r of data ?? []) {
        const w = Number(r.weight_kg);
        if (!best[r.exercise_slug] || w > best[r.exercise_slug]!.weight)
          best[r.exercise_slug] = { name: r.exercise_name, weight: w, reps: Number(r.reps ?? 0) };
      }
      return Object.values(best)
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 8);
    },
    enabled: !!user,
  });
  const volumeData = (sessions ?? []).map((s) => ({
    date: new Date(s.started_at).toLocaleDateString("lt-LT", { month: "2-digit", day: "2-digit" }),
    volume: Math.round(Number(s.total_volume ?? 0)),
  }));
  return (
    <div className="grid gap-8">
      <h1 className="text-5xl">{t("pr.title")}</h1>
      <PerformanceProgressPanel />
      <WeeklyIntelligenceReview />
      <AIProgressInsights />
      <ProgressForecast />
      <InjuryRiskRadar />
      <WorkoutReportExporter />
      <BodyCompositionScanner />
      <div className="panel p-6">
        <h2 className="text-2xl">{t("pr.volume")}</h2>
        {volumeData.length ? (
          <div className="mt-4 h-64">
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
          <p className="mt-3 text-sm text-muted-foreground">{t("pr.empty")}</p>
        )}
      </div>
      <BodyMetricsPanel />
      <div className="panel p-6">
        <h2 className="flex items-center gap-2 text-2xl">
          <Trophy className="size-5 text-accent" /> {t("pr.records")}
        </h2>
        {records?.length ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {records.map((r) => (
              <div
                key={r.name}
                className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3"
              >
                <span className="text-sm font-semibold">{r.name}</span>
                <span className="text-display text-xl text-primary">
                  {r.weight} kg × {r.reps}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">{t("pr.empty")}</p>
        )}
      </div>
      <div className="panel p-6">
        <h2 className="text-2xl">{t("pr.history")}</h2>
        <div className="mt-4 grid gap-2">
          {[...(sessions ?? [])].reverse().map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3 text-sm"
            >
              <span className="font-semibold">{s.title}</span>
              <span className="text-muted-foreground">
                {new Date(s.started_at).toLocaleDateString("lt-LT")} ·{" "}
                {Math.round(Number(s.total_volume ?? 0))} kg ·{" "}
                {Math.round((s.duration_seconds ?? 0) / 60)} min
              </span>
            </div>
          ))}
          {!sessions?.length && <p className="text-sm text-muted-foreground">{t("pr.empty")}</p>}
        </div>
      </div>
    </div>
  );
}
