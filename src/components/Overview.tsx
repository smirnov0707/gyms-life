import { ReadinessCard } from "@/components/ReadinessCard";
import { QuickFoodLog } from "@/components/QuickFoodLog";
import { QuickRunLog } from "@/components/QuickRunLog";
import { LiveSignals } from "@/components/LiveSignals";
import { PredictionEvidencePanel } from "@/components/PredictionEvidencePanel";
import { SleepAnalysis } from "@/components/SleepAnalysis";
import { RecoveryOutlook } from "@/components/RecoveryOutlook";
import { MorningLabReview } from "@/components/future-lab/MorningLabReview";
import { Link } from "@tanstack/react-router";
import { ReadinessWorkspace } from "@/routes/_authenticated/readiness";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { TwinHome } from "@/components/twin/TwinHome";
import { baseLang } from "@/lib/i18n";
import "./future-lab-dashboard.css";
import { TodayDecision } from "@/components/TodayDecision";
import { TodayLifeContext } from "@/components/TodayLifeContext";
import { TodaysPlanPanel } from "@/components/TodaysPlanPanel";
import { TodayRaceCommand } from "@/components/TodayRaceCommand";
import { DataSourcesStrip } from "@/components/DataSourcesStrip";
import { TodayIntelligenceBrief } from "@/components/future-lab/TodayIntelligenceBrief";
import { getTodaysWorkout } from "@/lib/todays-workout.functions";
import { parseStoredTrainingPlan } from "@/lib/training-plan.schema";
import { useLocalizedPlan } from "@/lib/use-localized-plan";
import { browserTimeZone, dayInTimeZone } from "@/lib/local-day";

function ReadinessRing({ score }: { score: number }) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, score)) / 100);
  // A readiness ring is a three-step measurement scale, so it runs through the
  // measurement colours. The low step was `destructive` — the error token — so
  // a readiness of 54 was painted the same red as a failed account deletion.
  // Ember is the attention colour and says what is true: a low reading.
  const tone = score >= 80 ? "text-primary" : score >= 55 ? "text-accent" : "text-ember";
  return (
    <div className="relative grid size-14 place-items-center">
      <svg viewBox="0 0 56 56" className="absolute inset-0 size-14 -rotate-90" aria-hidden="true">
        <circle
          cx="28"
          cy="28"
          r={radius}
          className="stroke-border"
          strokeWidth="4"
          fill="transparent"
        />
        <circle
          cx="28"
          cy="28"
          r={radius}
          stroke="currentColor"
          className={`${tone} transition-all duration-700 motion-reduce:transition-none`}
          strokeWidth="4"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="text-sm font-semibold">{score}</span>
    </div>
  );
}

export function Overview() {
  const { t, lang } = useI18n();
  const english = baseLang(lang) === "en";
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const timeZone = browserTimeZone();
  const localDay = dayInTimeZone(new Date(), timeZone);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!user,
  });
  const { data: plan, isError: planReadFailed } = useQuery({
    queryKey: ["active-plan", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("id, data, lang")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!user,
  });
  const { data: nextWorkoutData } = useQuery({
    queryKey: ["todays-workout", user?.id, timeZone],
    queryFn: () => getTodaysWorkout({ data: { timeZone } }),
    enabled: !!user,
    staleTime: 60_000,
  });
  const { data: checkin, isError: readinessReadFailed } = useQuery({
    queryKey: ["today-checkin", user?.id, localDay],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_checkins")
        .select("readiness_score")
        .eq("user_id", user!.id)
        .eq("checkin_on", localDay)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!user,
  });

  const storedPlan = plan ? parseStoredTrainingPlan(plan.data) : null;
  const { plan: planData } = useLocalizedPlan(
    plan?.id,
    storedPlan ?? undefined,
    plan?.lang ?? "lt",
  );
  const firstName = useMemo(() => {
    const metadata = user?.user_metadata ?? {};
    const fullName = metadata["full_name"];
    const name = metadata["name"];
    const raw =
      profile?.display_name ||
      (typeof fullName === "string" ? fullName : "") ||
      (typeof name === "string" ? name : "") ||
      (user?.email ? user.email.split("@")[0] : "");
    const cleaned = (raw ?? "").trim().split(/\s+/)[0] ?? "";
    return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : "";
  }, [profile, user]);
  const hour = new Date().getHours();
  const greeting = t(hour < 12 ? "dash.morning" : hour < 18 ? "dash.afternoon" : "dash.evening");
  const readinessScore = checkin?.readiness_score != null ? Number(checkin.readiness_score) : null;
  const recoveryState = useMemo(
    () =>
      readinessScore == null
        ? null
        : readinessScore >= 80
          ? t("tl.heat.ready")
          : readinessScore >= 55
            ? t("tl.heat.optimal")
            : t("tl.heat.fatigued"),
    [readinessScore, t],
  );
  const today = nextWorkoutData?.status === "READY" ? nextWorkoutData.workout : undefined;
  const livingState =
    readinessScore == null || !Number.isFinite(readinessScore)
      ? "unknown"
      : readinessScore >= 80
        ? "ready"
        : readinessScore >= 55
          ? "balanced"
          : "recover";
  const dayPhase = hour < 6 ? "night" : hour < 12 ? "morning" : hour < 18 ? "day" : "evening";
  return (
    <div
      className="fl-dashboard fl-page-enter"
      data-living-state={livingState}
      data-day-phase={dayPhase}
    >
      <div className="fl-today-root mx-auto grid w-full max-w-[1480px] gap-4">
        <header className="fl-greeting fl-today-hero-copy fl-performance-masthead">
          <p className="fl-eyebrow fl-mobile-page-name">{t("nav.today")}</p>
          <h1>
            {greeting}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p>{planData ? planData.title : planReadFailed ? t("ov.planReadFailed") : t("ob.sub")}</p>
        </header>
        <section
          className="fl-today-command fl-premium-card grid min-w-0 gap-4 overflow-hidden rounded-[2rem] border border-border bg-surface p-4 sm:p-5 lg:grid-cols-[minmax(0,.72fr)_minmax(0,1.25fr)]"
          aria-label={english ? "Today's command" : "Šiandienos sprendimas"}
        >
          <div className="fl-today-command-copy grid min-w-0 content-start gap-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-primary">
              {english ? "TODAY COMMAND" : "ŠIANDIENOS VEIKSMAS"}
            </p>
            {readinessScore != null && Number.isFinite(readinessScore) ? (
              <ReadinessCard
                compact
                score={readinessScore}
                state={recoveryState}
                ring={<ReadinessRing score={readinessScore} />}
              />
            ) : (
              <div className="fl-surface fl-readiness-empty">
                <details className="fl-readiness-inline group">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3">
                    <span>
                      <span className="fl-eyebrow block">
                        {english ? "Today's state" : "Šiandienos būsena"}
                      </span>
                      <span className="mt-1 block text-sm font-medium text-foreground">
                        {readinessReadFailed
                          ? english
                            ? "Readiness unavailable"
                            : "Būsena nepasiekiama"
                          : english
                            ? "How are you feeling?"
                            : "Kaip jautiesi?"}
                      </span>
                    </span>
                    {!readinessReadFailed ? (
                      <span className="shrink-0 text-xs font-semibold text-primary">
                        {english ? "Check in" : "Įvertinti"} →
                      </span>
                    ) : null}
                  </summary>
                  {!readinessReadFailed ? (
                    <div className="mt-3 border-t border-border pt-3">
                      <ReadinessWorkspace embedded />
                    </div>
                  ) : null}
                </details>
              </div>
            )}
            <TodayDecision
              compact
              workoutDay={today?.day ?? null}
              primaryTrainingActionHandled={Boolean(today)}
            />
          </div>
          <div className="fl-today-plan grid min-w-0 content-start gap-3">
            <TodaysPlanPanel />
            <TodayRaceCommand />
            <details className="fl-surface fl-today-execution group">
              <summary className="cursor-pointer list-none px-4 py-3 text-xs font-semibold text-foreground">
                {english ? "I ran today" : "Šiandien bėgau"}
              </summary>
              <div className="border-t border-border p-4">
                <QuickRunLog
                  onLogged={async () => {
                    await queryClient.invalidateQueries({ queryKey: ["todays-workout", user?.id] });
                  }}
                />
              </div>
            </details>
            <details className="fl-surface fl-today-execution group">
              <summary className="cursor-pointer list-none px-4 py-3 text-xs font-semibold text-foreground">
                {english ? "Log food" : "Įrašyti maistą"}
              </summary>
              <div className="border-t border-border p-4">
                <QuickFoodLog compact />
                <Link to="/nutrition" className="fl-text-link mt-3 inline-flex">
                  {english ? "Open Nutrition Intelligence" : "Atidaryti Nutrition Intelligence"} →
                </Link>
              </div>
            </details>
          </div>
        </section>

        <section className="fl-today-world grid min-w-0 items-start gap-4 xl:grid-cols-[1.15fr_.85fr]">
          <details className="fl-today-twin-mobile fl-luxury-disclosure rounded-[1.75rem] border border-border bg-surface/80">
            <summary className="cursor-pointer list-none px-4 py-3 text-xs font-semibold text-foreground">
              {english ? "Open My Twin" : "Atidaryti My Twin"}
            </summary>
            <div className="border-t border-border p-3">
              <Link to="/twin" className="fl-text-link inline-flex">
                {english
                  ? "Explore body, systems & trajectory"
                  : "Tyrinėti kūną, sistemas ir trajektoriją"}{" "}
                →
              </Link>
            </div>
          </details>
          <div className="fl-today-twin min-w-0">
            <TwinHome presentation="cockpit" />
          </div>

          <details className="fl-today-context fl-luxury-disclosure rounded-[1.75rem] border border-border bg-surface/80">
            <summary className="cursor-pointer list-none px-4 py-3 text-xs font-semibold text-foreground">
              {english ? "Deeper context" : "Išsamesnis kontekstas"}
            </summary>
            <div className="grid gap-4 border-t border-border p-4">
              <section className="fl-today-changes grid gap-3">
                <p className="fl-eyebrow">{english ? "What changed" : "Kas pasikeitė"}</p>
                <MorningLabReview compact />
                <TodayIntelligenceBrief presentation="cards" />
              </section>

              <details className="fl-surface group">
                <summary className="cursor-pointer list-none px-4 py-3 text-xs font-semibold text-foreground">
                  {english ? "Signals & evidence" : "Signalai ir įrodymai"}
                </summary>
                <div className="grid gap-4 border-t border-border p-4">
                  <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
                    <LiveSignals />
                    <RecoveryOutlook compact />
                    <SleepAnalysis />
                    <PredictionEvidencePanel compact />
                  </div>
                  <DataSourcesStrip />
                  <TodayLifeContext />
                </div>
              </details>

              {planData ? (
                <Link to="/onboarding" className="fl-text-link w-fit">
                  {t("dash.regenerate")} →
                </Link>
              ) : null}
            </div>
          </details>
        </section>
      </div>
    </div>
  );
}
