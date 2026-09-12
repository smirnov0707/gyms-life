import { NightLabRitual } from "@/components/future-lab/NightLabRitual";
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
import { TwinPulse } from "@/components/TwinPulse";
import { WhyThisDisclosure } from "@/components/intelligence/WhyThisDisclosure";
import { TodayDecision } from "@/components/TodayDecision";
import { TodayLifeContext } from "@/components/TodayLifeContext";
import { LiveSignals } from "@/components/LiveSignals";
import { TodaysPlanPanel } from "@/components/TodaysPlanPanel";
import { DataSourcesStrip } from "@/components/DataSourcesStrip";
import { PredictionEvidencePanel } from "@/components/PredictionEvidencePanel";
import { SleepAnalysis } from "@/components/SleepAnalysis";
import { RecoveryOutlook } from "@/components/RecoveryOutlook";
import { TodayIntelligenceBrief } from "@/components/future-lab/TodayIntelligenceBrief";
import { getTodaysWorkout } from "@/lib/todays-workout.functions";
import { parseStoredTrainingPlan } from "@/lib/training-plan.schema";
import { useLocalizedPlan } from "@/lib/use-localized-plan";
import { browserTimeZone, dayInTimeZone } from "@/lib/local-day";

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

      <TwinPulse />
      <NightLabRitual />

      <section className="rounded-2xl border border-border bg-surface/85 p-3 sm:p-4">
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
      </section>

      <TodayIntelligenceBrief />

      <WhyThisDisclosure
        summary={english ? "Why this? · Evidence & signals" : "Kodėl taip? · Įrodymai ir signalai"}
        className="bg-surface/75"
      >
        <div className="grid gap-3 p-3 sm:p-4 lg:grid-cols-2 xl:grid-cols-3">
          <div className="lg:col-span-2 xl:col-span-3">
            <SmartBrief compact />
          </div>
          <PredictionEvidencePanel compact />
          <RecoveryOutlook compact />
          <SleepAnalysis />
          <div className="lg:col-span-2 xl:col-span-3">
            <LiveSignals />
          </div>
        </div>
      </WhyThisDisclosure>

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
