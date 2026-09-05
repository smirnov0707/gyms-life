import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n, type TKey } from "@/lib/i18n";
import {
  buildRiskReport,
  RISK_HIGH_AT,
  RISK_MODERATE_AT,
  type RiskLevel,
  type RiskReport,
} from "@/lib/injury-risk";
import { cn } from "@/lib/utils";

/**
 * Risk tones. Each sets the dark value bare and the light one behind the
 * `light:` variant, because a single tint cannot carry legible contrast on
 * both an onyx and a near-white ground.
 */
const TONE: Record<RiskLevel, { chip: string; bar: string; text: string }> = {
  low: {
    chip: "bg-emerald-400/12 text-emerald-300 light:bg-emerald-600/10 light:text-emerald-700",
    bar: "bg-emerald-400/30 light:bg-emerald-600/25",
    text: "text-emerald-300 light:text-emerald-700",
  },
  moderate: {
    chip: "bg-amber-400/12 text-amber-300 light:bg-amber-600/10 light:text-amber-700",
    bar: "bg-amber-400/30 light:bg-amber-600/25",
    text: "text-amber-300 light:text-amber-700",
  },
  high: {
    chip: "bg-rose-400/12 text-rose-300 light:bg-rose-600/10 light:text-rose-700",
    bar: "bg-rose-400/30 light:bg-rose-600/25",
    text: "text-rose-300 light:text-rose-700",
  },
};

const LEVEL_KEY = {
  low: "nx.risk.low",
  moderate: "nx.risk.moderate",
  high: "nx.risk.high",
} as const;

/**
 * The score on its own scale, with the boundaries the report actually uses
 * marked where they fall. The figure is decorative: the score, the level
 * and both thresholds are all written out beside it.
 */
function RiskScale({ score, level }: { score: number; level: RiskLevel }) {
  const zones: { level: RiskLevel; width: number }[] = [
    { level: "low", width: RISK_MODERATE_AT },
    { level: "moderate", width: RISK_HIGH_AT - RISK_MODERATE_AT },
    { level: "high", width: 100 - RISK_HIGH_AT },
  ];

  return (
    <div aria-hidden="true" className="mt-3">
      <div className="relative flex h-2.5 overflow-hidden rounded-full">
        {zones.map((zone) => (
          <span
            key={zone.level}
            className={cn("h-full", TONE[zone.level].bar)}
            style={{ width: `${zone.width}%` }}
          />
        ))}
        <span
          className="absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
          style={{ left: `${score}%` }}
        />
      </div>
      <div className="relative mt-1 h-4 font-mono text-[10px] text-muted-foreground">
        <span className="absolute left-0">0</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${RISK_MODERATE_AT}%` }}>
          {RISK_MODERATE_AT}
        </span>
        <span className="absolute -translate-x-1/2" style={{ left: `${RISK_HIGH_AT}%` }}>
          {RISK_HIGH_AT}
        </span>
        <span className="absolute right-0">100</span>
      </div>
      <span className="sr-only">{level}</span>
    </div>
  );
}

/**
 * Part XI injury risk. Everything here comes from `buildRiskReport`, a
 * deterministic model over the athlete's own last thirty days of sets,
 * sessions and check-ins. It reports what it measured, names the terms it
 * could not measure, and claims nothing beyond that: no exercise in this
 * app is substituted on the strength of this score.
 */
export function InjuryRiskRadar() {
  const { t } = useI18n();
  const { user } = useAuth();

  const { data, isPending, isError } = useQuery({
    queryKey: ["injury-risk", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const [sets, sessions, checkins] = await Promise.all([
        supabase
          .from("set_logs")
          .select("performed_at, exercise_slug, exercise_name, weight_kg, reps")
          .eq("user_id", user!.id)
          .gte("performed_at", since)
          .order("performed_at", { ascending: true }),
        supabase
          .from("workout_sessions")
          .select("started_at, total_volume")
          .eq("user_id", user!.id)
          .gte("started_at", since),
        supabase
          .from("daily_checkins")
          .select("checkin_on, soreness, readiness_score")
          .eq("user_id", user!.id)
          .order("checkin_on", { ascending: false })
          .limit(14),
      ]);
      // A failed read used to arrive here as an empty array, which the
      // model reads as "this athlete has never trained" — the same screen
      // a beginner sees, shown to someone with months of history. Fail
      // loudly instead.
      const failure = sets.error ?? sessions.error ?? checkins.error;
      if (failure) throw new Error(failure.message);
      return buildRiskReport(sets.data ?? [], sessions.data ?? [], checkins.data ?? []);
    },
  });

  return (
    <InjuryRiskView
      state={
        isPending
          ? { status: "loading" }
          : isError || data === undefined
            ? { status: "failed" }
            : { status: "report", report: data }
      }
      t={t}
    />
  );
}

/**
 * What the panel looks like for a given report. Separated from the read so
 * every state — loading, failed, no history, a full report — can be looked
 * at directly.
 */
export type InjuryRiskViewState =
  { status: "loading" } | { status: "failed" } | { status: "report"; report: RiskReport };

export function InjuryRiskView({
  state,
  t,
}: {
  state: InjuryRiskViewState;
  t: (key: TKey) => string;
}) {
  const data = state.status === "report" ? state.report : undefined;
  const level = data?.level ?? "low";
  const tone = TONE[level];
  const showsReport = data !== undefined && data.hasData;
  const Icon = !showsReport ? ShieldQuestion : level === "low" ? ShieldCheck : ShieldAlert;

  return (
    <section className="rounded-2xl border border-border bg-surface-2 p-5 text-left sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "rounded-xl border border-border p-2.5",
              showsReport ? tone.chip : "text-muted-foreground",
            )}
          >
            <Icon className="size-6" />
          </span>
          <div>
            <h2 className="text-lg font-bold sm:text-xl">{t("nx.risk.title")}</h2>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
              {t("nx.risk.subtitle")}
            </p>
          </div>
        </div>

        {showsReport && (
          <div className="min-w-[13rem] flex-1 sm:max-w-xs">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {t("nx.risk.score")}
            </p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className={cn("font-mono text-2xl font-bold", tone.text)}>{data.score}</span>
              <span className="font-mono text-xs text-muted-foreground">/ 100</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider",
                  tone.chip,
                )}
              >
                {t(LEVEL_KEY[level])}
              </span>
            </p>
            <RiskScale score={data.score} level={level} />
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {t("nx.risk.scale")}
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 space-y-2.5">
        {state.status === "loading" ? (
          <p className="rounded-xl border border-border bg-surface p-4 text-center text-xs text-muted-foreground">
            {t("nx.risk.loading")}
          </p>
        ) : state.status === "failed" ? (
          <p className="rounded-xl border border-border bg-surface p-4 text-center text-xs text-muted-foreground">
            {t("nx.risk.failed")}
          </p>
        ) : !showsReport || data.factors.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface p-4 text-center text-xs text-muted-foreground">
            {t("nx.risk.empty")}
          </p>
        ) : (
          data.factors.map((factor) => (
            <div
              key={factor.key}
              className="space-y-1.5 rounded-xl border border-border bg-surface p-3.5"
            >
              <div className="flex items-center justify-between gap-3 text-xs font-semibold">
                <span className="text-foreground">{t(factor.key)}</span>
                <span
                  className={cn(
                    "shrink-0 rounded px-2 py-0.5 font-mono font-bold",
                    TONE[factor.level].chip,
                  )}
                >
                  {factor.value}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {t(factor.adviceKey)}
              </p>
            </div>
          ))
        )}
      </div>

      {/* An additive score is flattered by the terms it could not compute.
          Naming them is the difference between a low score and a low score
          the athlete can trust. An athlete with no history at all is told
          that once, by the empty state — listing all five underneath it
          would only say the same thing a second time. */}
      {showsReport && data.unassessed.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {t("nx.risk.unassessed")}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {data.unassessed.map((key) => t(key)).join(" · ")}
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            {t("nx.risk.unassessed.note")}
          </p>
        </div>
      )}
    </section>
  );
}

export default InjuryRiskRadar;
