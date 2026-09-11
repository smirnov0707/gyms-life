import { MorningLabReview } from "@/components/future-lab/MorningLabReview";
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
  const tone =
    score >= 80
      ? "text-emerald-400 light:text-emerald-700"
      : score >= 55
        ? "text-teal-400 light:text-teal-700"
        : "text-destructive";
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
    <main className="mx-auto w-full max-w-[1480px] space-y-4 px-3 pb-8 sm:px-4 lg:px-6">
      <header className="flex flex-col gap-1 pt-2 sm:pt-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-violet-300 light:text-violet-700">
          {t("nav.today")} · GYMS.LIFE INTELLIGENCE
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {greeting}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {english
            ? "One decision, backed by your current state and longitudinal evidence."
            : "Vienas sprendimas, paremtas dabartine tavo būsena ir ilgalaikiais duomenimis."}
        </p>
      </header>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <TodayDecision
          workoutDay={today?.day ?? null}
          primaryTrainingActionHandled={Boolean(today)}
        />
        <div className="min-h-[360px] overflow-hidden rounded-2xl border border-border bg-surface/80">
          <TwinHome presentation="cockpit" />
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-2xl border border-border bg-surface/85 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                {english ? "SYSTEM STATE" : "SISTEMOS BŪSENA"}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">
                {readinessScore == null
                  ? english
                    ? "State still forming"
                    : "Būsena dar formuojama"
                  : (recoveryState ?? (english ? "Current state" : "Dabartinė būsena"))}
              </h2>
            </div>
            {readinessScore != null && Number.isFinite(readinessScore) ? (
              <ReadinessRing score={readinessScore} />
            ) : null}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {readinessScore == null
              ? readinessReadFailed
                ? t("ov.readinessReadFailed")
                : english
                  ? "Complete today's check-in to sharpen the decision boundary."
                  : "Užpildyk šiandienos check-in, kad sprendimo riba būtų tikslesnė."
              : english
                ? `Readiness ${Math.round(readinessScore)}/100 is one input, not the whole decision.`
                : `Pasiruošimas ${Math.round(readinessScore)}/100 yra tik vienas signalas, ne visas sprendimas.`}
          </p>
          {readinessScore == null ? (
            <Link
              to="/readiness"
              className="mt-3 inline-flex min-h-11 items-center text-xs font-medium text-violet-300"
            >
              {english ? "Complete check-in" : "Užpildyti check-in"} →
            </Link>
          ) : null}
          <div className="mt-3 grid gap-2">
            <MorningLabReview compact />
            <SmartBrief compact />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface/85 p-3 sm:p-4">
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <div>
              <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                {english ? "TODAY'S EXECUTION" : "ŠIANDIENOS VYKDYMAS"}
              </p>
              <h2 className="mt-1 text-base font-semibold text-foreground">
                {planData ? planData.title : planReadFailed ? t("ov.planReadFailed") : t("ob.sub")}
              </h2>
            </div>
          </div>
          <TodaysPlanPanel />
        </div>
      </section>

      <FutureLabTodayIntelligence />

      <details className="group rounded-2xl border border-border bg-surface/75">
        <summary className="cursor-pointer list-none px-4 py-4 text-sm font-medium text-foreground sm:px-5">
          <span className="flex items-center justify-between gap-3">
            <span>
              {english ? "Why this? · Evidence & signals" : "Kodėl taip? · Įrodymai ir signalai"}
            </span>
            <span className="text-xs text-muted-foreground group-open:hidden">+</span>
            <span className="hidden text-xs text-muted-foreground group-open:inline">−</span>
          </span>
        </summary>
        <div className="grid gap-3 border-t border-border p-3 sm:p-4 lg:grid-cols-2 xl:grid-cols-3">
          <PredictionEvidencePanel compact />
          <RecoveryOutlook compact />
          <SleepAnalysis />
          <div className="lg:col-span-2 xl:col-span-3">
            <LiveSignals />
          </div>
        </div>
      </details>

      <details className="group rounded-2xl border border-border/70 bg-surface/60">
        <summary className="cursor-pointer list-none px-4 py-3 text-xs font-medium text-muted-foreground sm:px-5">
          {english ? "Context, sources & settings" : "Kontekstas, šaltiniai ir nustatymai"}
        </summary>
        <div className="space-y-3 border-t border-border p-4">
          <DataSourcesStrip />
          <TodayLifeContext />
          {planData ? (
            <Link
              to="/onboarding"
              className="inline-flex min-h-11 items-center text-xs font-medium text-violet-300"
            >
              {t("dash.regenerate")} →
            </Link>
          ) : null}
        </div>
      </details>
    </main>
  );
}
