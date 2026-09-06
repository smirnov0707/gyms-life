import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { TwinTodayCard } from "@/components/twin/TwinTodayCard";
import { SmartBrief } from "@/components/SmartBrief";
import { ReadinessCard } from "@/components/ReadinessCard";
import { TodayDecision } from "@/components/TodayDecision";
import { TodayLifeContext } from "@/components/TodayLifeContext";
import { LiveSignals } from "@/components/LiveSignals";
import { FutureLabPredictionOutlook } from "@/components/future-lab/FutureLabPredictionOutlook";
import { FutureLabScientistStatus } from "@/components/future-lab/FutureLabScientistStatus";
import { FutureLabTodayIntelligence } from "@/components/future-lab/FutureLabTodayIntelligence";
import { FutureLabTodayPlan } from "@/components/future-lab/FutureLabTodayPlan";
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
      <svg className="absolute inset-0 size-14 -rotate-90" aria-hidden="true">
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
          className={`${tone} transition-all duration-700 motion-reduce:transition-none`}
          strokeWidth="4"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="text-display text-sm font-bold">{score}</span>
    </div>
  );
}

export function Overview() {
  const { t } = useI18n();
  const { user } = useAuth();
  const timeZone = browserTimeZone();
  const localDay = dayInTimeZone(new Date(), timeZone);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
  const {
    data: plan,
    isLoading,
    isError: planReadFailed,
  } = useQuery({
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
  const anim = (delay: string) =>
    `transition-all duration-700 motion-reduce:transition-none ${delay} ${mounted ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`;

  if (isLoading) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-[#142239] bg-[#030914]/72 p-3 shadow-[0_35px_120px_rgba(0,0,0,.28)] sm:p-4 lg:p-5">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(37,99,235,.10),transparent_31%),radial-gradient(circle_at_72%_5%,rgba(124,58,237,.10),transparent_24%)]"
      />
      <div className="relative grid gap-3 lg:grid-cols-12">
        <section
          className={`flex items-end justify-between gap-4 border-b border-[#17243b] pb-4 lg:col-span-12 ${anim("")}`}
        >
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-cyan-300/75">
              GYMS.LIFE FUTURE LAB · TODAY
            </p>
            <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-white sm:text-4xl">
              {greeting}
              {firstName ? `, ${firstName}` : ""} 👋
            </h1>
            <p className="mt-1.5 text-xs text-slate-400">
              {planData ? planData.title : planReadFailed ? t("ov.planReadFailed") : t("ob.sub")}
            </p>
          </div>
          {planData ? (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden shrink-0 rounded-xl border border-[#1a2941] bg-[#08111e] text-xs text-slate-400 sm:inline-flex"
            >
              <Link to="/onboarding">{t("dash.regenerate")}</Link>
            </Button>
          ) : null}
        </section>

        <aside className={`grid content-start gap-3 lg:col-span-3 ${anim("delay-75")}`}>
          <LiveSignals />
          <FutureLabTodayPlan state={nextWorkoutData} />
          {readinessScore != null ? (
            <ReadinessCard
              score={readinessScore}
              state={recoveryState}
              ring={<ReadinessRing score={readinessScore} />}
            />
          ) : readinessReadFailed ? (
            <p className="rounded-2xl border border-[#1a2941] bg-[#08111e] p-4 text-sm text-slate-400">
              {t("ov.readinessReadFailed")}
            </p>
          ) : null}
        </aside>

        <div
          className={`grid content-start gap-3 lg:col-span-6 ${anim("delay-100")}`}
          aria-label={t("nav.today")}
        >
          <TwinTodayCard />
          <div className="grid gap-3 xl:grid-cols-2">
            <TodayDecision workoutDay={today?.day ?? null} />
            <TodayLifeContext />
          </div>
        </div>

        <aside className={`grid content-start gap-3 lg:col-span-3 ${anim("delay-150")}`}>
          <FutureLabScientistStatus compact />
          <FutureLabPredictionOutlook />
          <SmartBrief />
        </aside>

        <div className={`lg:col-span-12 ${anim("delay-200")}`}>
          <FutureLabTodayIntelligence />
        </div>
      </div>
    </div>
  );
}
