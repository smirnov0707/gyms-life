import { useQuery } from "@tanstack/react-query";
import { Activity, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { baseLang, useI18n, type TKey } from "@/lib/i18n";
import { TwinLedgerState } from "@/components/twin/TwinLedgerState";
import "./InjuryRiskRadar.css";
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
    chip: "bg-emerald-400/12 text-emerald-300 light:bg-emerald-600/10 light:text-emerald-800",
    bar: "bg-emerald-400/30 light:bg-emerald-600/25",
    text: "text-emerald-300 light:text-emerald-800",
  },
  moderate: {
    chip: "bg-amber-400/12 text-amber-300 light:bg-amber-600/10 light:text-amber-800",
    bar: "bg-amber-400/30 light:bg-amber-600/25",
    text: "text-amber-300 light:text-amber-800",
  },
  high: {
    chip: "bg-rose-400/12 text-rose-300 light:bg-rose-600/10 light:text-rose-800",
    bar: "bg-rose-400/30 light:bg-rose-600/25",
    text: "text-rose-300 light:text-rose-800",
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
function RiskScale({ score }: { score: number }) {
  const zones: { level: RiskLevel; width: number }[] = [
    { level: "low", width: RISK_MODERATE_AT },
    { level: "moderate", width: RISK_HIGH_AT - RISK_MODERATE_AT },
    { level: "high", width: 100 - RISK_HIGH_AT },
  ];

  return (
    <div aria-hidden="true" className="fl-risk-scale">
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

  const { data, isPending, isError, isFetching, refetch } = useQuery({
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
      onRetry={() => void refetch()}
      retrying={isFetching}
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

const COPY = {
  en: {
    eyebrow: "Load & recovery",
    overview: "Signals in your training",
    assessed: "Assessed factors",
    factors: "What contributes to the score",
    method: "How to read this score",
    model: "The score summarizes recorded signals. It is not a percentage probability of injury.",
    missing:
      "Missing factors add nothing to this score. Read it together with the data coverage below.",
    complete: "All five factors could be assessed from the loaded history.",
    failed: "Training signals are unavailable",
    failedDetail: "Your history could not be read. Try again to restore the report.",
    empty: "No training signals yet",
    unmeasured: "More measured signals are needed",
    unmeasuredDetail:
      "The loaded records do not support any of the five factors yet. No score is shown.",
    boundaries: "Model thresholds",
  },
  lt: {
    eyebrow: "Krūvis ir atsistatymas",
    overview: "Tavo treniruočių signalai",
    assessed: "Įvertinti veiksniai",
    factors: "Kas sudaro šį balą",
    method: "Kaip skaityti šį balą",
    model: "Balas apibendrina užregistruotus signalus. Tai nėra traumos tikimybės procentas.",
    missing:
      "Trūkstami veiksniai prie balo neprisideda. Vertink jį kartu su žemiau nurodyta duomenų aprėptimi.",
    complete: "Įkelta istorija leido įvertinti visus penkis veiksnius.",
    failed: "Treniruočių signalai nepasiekiami",
    failedDetail: "Nepavyko perskaityti istorijos. Bandyk dar kartą, kad atkurtum ataskaitą.",
    empty: "Treniruočių signalų dar nėra",
    unmeasured: "Reikia daugiau išmatuotų signalų",
    unmeasuredDetail:
      "Įkelti įrašai dar neleidžia įvertinti nė vieno iš penkių veiksnių. Balas nerodomas.",
    boundaries: "Modelio ribos",
  },
} as const;

export function InjuryRiskView({
  state,
  t,
  onRetry,
  retrying = false,
}: {
  state: InjuryRiskViewState;
  t: (key: TKey) => string;
  onRetry?: (() => void) | undefined;
  retrying?: boolean;
}) {
  const { lang } = useI18n();
  const copy = COPY[baseLang(lang)];
  const data = state.status === "report" ? state.report : undefined;
  const showsReport = data !== undefined && data.hasData && data.factors.length > 0;

  return (
    <section className="fl-risk-review" data-state={state.status}>
      <header className="fl-ledger-heading">
        <div className="fl-ledger-eyebrow">
          <Activity aria-hidden="true" />
          {copy.eyebrow}
        </div>
        <h2>{t("nx.risk.title")}</h2>
        <p>{t("nx.risk.subtitle")}</p>
      </header>
      {state.status === "loading" ? (
        <TwinLedgerState state="loading" title={t("nx.risk.loading")} />
      ) : state.status === "failed" ? (
        <TwinLedgerState
          state="error"
          title={copy.failed}
          description={copy.failedDetail}
          onRetry={onRetry}
          retrying={retrying}
        />
      ) : !showsReport ? (
        <TwinLedgerState
          state="empty"
          title={data?.hasData ? copy.unmeasured : copy.empty}
          description={data?.hasData ? copy.unmeasuredDetail : t("nx.risk.empty")}
        />
      ) : (
        <>
          <div className="fl-risk-overview">
            <div className="fl-risk-summary">
              <h3>{copy.overview}</h3>
              <div className="fl-risk-score-line">
                <dl>
                  <dt>{t("nx.risk.score")}</dt>
                  <dd data-testid="risk-score" className={TONE[data.level].text}>
                    {data.score}
                    <small>/100</small>
                  </dd>
                </dl>
                <span
                  className={cn("fl-risk-level", TONE[data.level].chip)}
                  data-level={data.level}
                >
                  {t(LEVEL_KEY[data.level])}
                </span>
              </div>
              <RiskScale score={data.score} />
            </div>
            <div className="fl-risk-coverage">
              <dl>
                <dt>{copy.assessed}</dt>
                <dd>
                  {data.factors.length}
                  <small>/{data.factors.length + data.unassessed.length}</small>
                </dd>
              </dl>
              <p>{data.unassessed.length ? copy.missing : copy.complete}</p>
            </div>
          </div>
          <details className="fl-risk-method">
            <summary>
              <Info aria-hidden="true" />
              {copy.method}
            </summary>
            <div>
              <p>{copy.model}</p>
              <p>
                {copy.boundaries}: {t(LEVEL_KEY.low)} 0–{RISK_MODERATE_AT - 1} ·{" "}
                {t(LEVEL_KEY.moderate)} {RISK_MODERATE_AT}–{RISK_HIGH_AT - 1} · {t(LEVEL_KEY.high)}{" "}
                {RISK_HIGH_AT}–100.
              </p>
            </div>
          </details>
          <div className="fl-risk-factor-section">
            <h3>{copy.factors}</h3>
            <div className="fl-risk-factors">
              {data.factors.map((factor, index) => (
                <article key={factor.key} data-factor={factor.key}>
                  <header>
                    <span className="fl-risk-index" aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h4>{t(factor.key)}</h4>
                  </header>
                  <div className="fl-risk-factor-value">
                    <strong>{factor.value}</strong>
                    <span className={cn("fl-risk-level", TONE[factor.level].chip)}>
                      {t(LEVEL_KEY[factor.level])}
                    </span>
                  </div>
                  <p>{t(factor.adviceKey)}</p>
                </article>
              ))}
            </div>
          </div>
          {data.unassessed.length > 0 && (
            <section className="fl-risk-gaps">
              <h3>{t("nx.risk.unassessed")}</h3>
              <ul>
                {data.unassessed.map((key) => (
                  <li key={key}>{t(key)}</li>
                ))}
              </ul>
              <p>{t("nx.risk.unassessed.note")}</p>
            </section>
          )}
        </>
      )}
    </section>
  );
}

export default InjuryRiskRadar;
