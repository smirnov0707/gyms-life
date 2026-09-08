import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { TwinHome } from "@/components/twin/TwinHome";
import { FutureLabRoster } from "@/components/future-lab/FutureLabRoster";
import { baseLang } from "@/lib/i18n";
import "./future-lab-dashboard.css";
import { SmartBrief } from "@/components/SmartBrief";
import { ReadinessCard } from "@/components/ReadinessCard";
import { TodayDecision } from "@/components/TodayDecision";
import { TodayLifeContext } from "@/components/TodayLifeContext";
import { LiveSignals } from "@/components/LiveSignals";
import { TodaysPlanPanel } from "@/components/TodaysPlanPanel";
import { DataSourcesStrip } from "@/components/DataSourcesStrip";
import { PredictionEvidencePanel } from "@/components/PredictionEvidencePanel";
import { SleepAnalysis } from "@/components/SleepAnalysis";
import { RecoveryOutlook } from "@/components/RecoveryOutlook";
import { FutureLabTodayIntelligence } from "@/components/future-lab/FutureLabTodayIntelligence";
import { getTodaysWorkout } from "@/lib/todays-workout.functions";
import { parseStoredTrainingPlan } from "@/lib/training-plan.schema";
import { useLocalizedPlan } from "@/lib/use-localized-plan";
import { browserTimeZone, dayInTimeZone } from "@/lib/local-day";

function ReadinessRing({ score }: { score: number }) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, score)) / 100);
  const tone = score >= 80 ? "text-primary" : score >= 55 ? "text-accent" : "text-destructive";
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
  return (
    <div className="fl-dashboard">
      <div className="fl-cockpit">
        <div className="fl-left-rail">
          <aside className="fl-signal-rail">
            <LiveSignals />
          </aside>
          <div className="fl-plan">
            <TodaysPlanPanel />
          </div>
        </div>
        <div className="fl-daily-column">
          <header className="fl-greeting">
            <p className="fl-eyebrow fl-mobile-page-name">{t("nav.today")}</p>
            <h1>
              {greeting}
              {firstName ? `, ${firstName}` : ""} <span aria-hidden="true">👋</span>
            </h1>
            <p>
              {planData ? planData.title : planReadFailed ? t("ov.planReadFailed") : t("ob.sub")}
            </p>
          </header>
          <div className="fl-readiness">
            {readinessScore != null && Number.isFinite(readinessScore) ? (
              <ReadinessCard
                compact
                score={readinessScore}
                state={recoveryState}
                ring={<ReadinessRing score={readinessScore} />}
              />
            ) : (
              <div className="fl-surface fl-readiness-empty">
                <p className="fl-eyebrow">{english ? "Readiness" : "Pasiruošimas"}</p>
                <p>
                  {readinessReadFailed
                    ? t("ov.readinessReadFailed")
                    : english
                      ? "How are you feeling today?"
                      : "Kaip šiandien jautiesi?"}
                </p>
                <Link to="/readiness" className="fl-text-link">
                  {english ? "Check in" : "Įvertinti savijautą"} →
                </Link>
              </div>
            )}
          </div>
          <div className="fl-brief">
            <SmartBrief compact />
          </div>
          <div className="fl-decision">
            <TodayDecision compact workoutDay={today?.day ?? null} />
          </div>
        </div>
        <div className="fl-body">
          <TwinHome presentation="cockpit" />
        </div>
        <aside className="fl-laboratory">
          <FutureLabRoster />
        </aside>
        <aside className="fl-predictions">
          <PredictionEvidencePanel compact />
          <RecoveryOutlook compact />
          <SleepAnalysis />
        </aside>
      </div>
      <FutureLabTodayIntelligence />
      <div className="fl-dashboard-footer">
        <DataSourcesStrip />
        <details className="fl-context-disclosure">
          <summary>
            <span className="fl-context-label-full">
              {english
                ? "Daily context & programme settings"
                : "Dienos kontekstas ir programos nustatymai"}
            </span>
            <span className="fl-context-label-short">
              {english ? "Context & settings" : "Kontekstas ir nustatymai"}
            </span>
          </summary>
          <TodayLifeContext />
          {planData ? (
            <Link to="/onboarding" className="fl-text-link">
              {t("dash.regenerate")} →
            </Link>
          ) : null}
        </details>
      </div>
    </div>
  );
}
