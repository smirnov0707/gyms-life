import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  LineChart,
  Loader2,
  Minus,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { forecastProgress } from "@/lib/forecast.functions";
import type {
  DeterministicLiftForecast,
  DeterministicPerformanceForecast,
} from "@/lib/forecast.schema";
import { useI18n, type TKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const forecastMetricKeys = ["nx.fc.now", "nx.fc.in4", "nx.fc.in12"] satisfies TKey[];

const trendKey: Record<DeterministicLiftForecast["trend"], TKey> = {
  rising: "nx.fc.trend.rising",
  flat: "nx.fc.trend.flat",
  falling: "nx.fc.trend.falling",
};

const evidenceStrengthKey: Record<DeterministicLiftForecast["evidenceStrength"], TKey> = {
  low: "nx.fc.confidence.low",
  moderate: "nx.fc.confidence.moderate",
  high: "nx.fc.confidence.high",
};

/**
 * Shows a conservative estimate from completed, validated set logs. This is
 * deliberately separate from the workout decision engine: a forecast never
 * prescribes a load or changes the user's current plan.
 */
export function ProgressForecast() {
  const { t } = useI18n();
  const run = useServerFn(forecastProgress);
  const [loading, setLoading] = useState(false);
  const [forecast, setForecast] = useState<DeterministicPerformanceForecast | null>(null);
  const [failed, setFailed] = useState(false);

  const go = async () => {
    setLoading(true);
    setFailed(false);
    try {
      setForecast(await run({ data: {} }));
    } catch {
      setFailed(true);
      toast.error(t("nx.fc.unavailable"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-primary/25 bg-primary/10 p-2 text-primary">
            <LineChart className="size-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider">{t("nx.fc.title")}</h3>
            <p className="text-xs text-muted-foreground">{t("nx.fc.subtitle")}</p>
          </div>
        </div>
        <Button size="sm" onClick={() => void go()} disabled={loading} className="font-bold">
          {loading ? (
            <Loader2 className="mr-1 size-4 animate-spin" />
          ) : (
            <Sparkles className="mr-1 size-4" />
          )}
          {loading ? t("nx.fc.loading") : forecast ? t("nx.fc.again") : t("nx.fc.run")}
        </Button>
      </div>

      {failed ? <p className="text-xs text-destructive">{t("nx.fc.unavailable")}</p> : null}

      {forecast?.status === "learning" ? (
        <p className="rounded-2xl bg-surface-2 p-4 text-xs leading-relaxed text-muted-foreground">
          {t("nx.fc.empty")}
        </p>
      ) : null}

      {forecast?.status === "ready" ? (
        <div className="grid gap-3">
          {forecast.lifts.map((lift) => {
            const Trend =
              lift.trend === "rising"
                ? TrendingUp
                : lift.trend === "falling"
                  ? TrendingDown
                  : Minus;
            const tone =
              lift.trend === "rising"
                ? "text-primary"
                : lift.trend === "falling"
                  ? "text-destructive"
                  : "text-accent";
            const values = [
              lift.currentEstimated1RMKg,
              lift.projected4WeeksEstimated1RMKg,
              lift.projected12WeeksEstimated1RMKg,
            ];

            return (
              <article
                key={lift.exerciseSlug}
                className="rounded-2xl border border-border bg-surface-2 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-bold uppercase tracking-wide">{lift.exerciseName}</h4>
                  <span className={cn("flex items-center gap-1 text-xs font-medium", tone)}>
                    <Trend className="size-4" /> {t("nx.fc.trend")}: {t(trendKey[lift.trend])}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {values.map((value, index) => {
                    const key = forecastMetricKeys[index];
                    if (key === undefined) return null;
                    return (
                      <div key={key} className="rounded-xl bg-surface p-2">
                        <div className="text-display text-xl text-foreground">{value} kg</div>
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          {t(key)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <p>
                    {t("nx.fc.confidence")}: {t(evidenceStrengthKey[lift.evidenceStrength])}
                  </p>
                  <p>
                    {t("nx.fc.evidence")}: {lift.evidence.sessionCount} {t("nx.fc.sessions")} ·{" "}
                    {lift.evidence.weeksTracked} {t("nx.fc.weeks")} · {lift.evidence.spanDays}{" "}
                    {t("nx.fc.days")}
                    {lift.evidence.averageRpe === null ? "" : ` · RPE ${lift.evidence.averageRpe}`}
                  </p>
                </div>
              </article>
            );
          })}

          <p className="flex items-start gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" /> {t("nx.fc.method")}
          </p>
        </div>
      ) : null}
    </section>
  );
}
