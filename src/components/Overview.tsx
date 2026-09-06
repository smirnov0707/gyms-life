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

/**
 * Today is the decision surface, not a dashboard.
 *
 * The user sees one living representation of themselves, the current state,
 * the one meaningful change, and the best next action. Nutrition, supplements,
 * weekly programme detail, achievements and discovery browsing remain available
 * in their dedicated surfaces instead of competing for attention here.
 */
export function Overview() {
  const { t } = useI18n();
  const { user } = useAuth();
  const timeZone = browserTimeZone();
  const localDay = dayInTimeZone(new Date(), timeZone);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
      // A failed read used to arrive as `null`, which this screen renders
      // as "you have no programme yet" — and offers to generate one — to an
      // athlete whose programme is sitting right there in the database.
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
      // Same shape: a failure here silently removed the whole readiness
      // card, which reads as "you have not checked in" rather than "we
      // could not look".
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
    if (!cleaned) return "";
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }, [profile, user]);

  const hour = new Date().getHours();
  const greeting = t(hour < 12 ? "dash.morning" : hour < 18 ? "dash.afternoon" : "dash.evening");
  const readinessScore = checkin?.readiness_score != null ? Number(checkin.readiness_score) : null;
  const recoveryState = useMemo(() => {
    if (readinessScore == null) return null;
    if (readinessScore >= 80) return t("tl.heat.ready");
    if (readinessScore >= 55) return t("tl.heat.optimal");
    return t("tl.heat.fatigued");
  }, [readinessScore, t]);
  const today = nextWorkoutData?.status === "READY" ? nextWorkoutData.workout : undefined;

  const anim = (delay: string) =>
    `transition-all duration-700 motion-reduce:transition-none ${delay} ${
      mounted ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
    }`;

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
      <section
        className={`border-b border-border/70 pb-4 lg:col-span-12 md:pb-5 ${anim("")} flex items-end justify-between gap-4`}
      >
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-primary">
            {t("dash.welcomeBack")}
          </p>
          <h1 className="mt-1 truncate text-3xl shine-text sm:text-4xl md:text-5xl">
            {greeting}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          {planData ? (
            <p className="mt-1.5 truncate text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-sm">
              {planData.title}
            </p>
          ) : (
            <p className="mt-1.5 text-sm text-muted-foreground">
              {planReadFailed ? t("ov.planReadFailed") : t("ob.sub")}
            </p>
          )}
        </div>

        {planData ? (
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="hidden shrink-0 rounded-full text-xs text-muted-foreground sm:inline-flex"
          >
            <Link to="/onboarding">{t("dash.regenerate")}</Link>
          </Button>
        ) : null}
      </section>

      {/* Left rail: what is measured about the athlete right now, and what is
          not. It sits beside the decision rather than under it, because the
          evidence and the call it produced should be readable together. */}
      <aside className={`grid content-start gap-4 lg:col-span-4 xl:col-span-3 ${anim("delay-75")}`}>
        <LiveSignals />
        {readinessScore != null ? (
          <ReadinessCard
            score={readinessScore}
            state={recoveryState}
            ring={<ReadinessRing score={readinessScore} />}
          />
        ) : readinessReadFailed ? (
          <p className="rounded-2xl border border-border bg-surface-2 p-4 text-sm text-muted-foreground">
            {t("ov.readinessReadFailed")}
          </p>
        ) : null}
      </aside>

      <div
        className={`grid content-start gap-4 lg:col-span-8 xl:col-span-9 ${anim("delay-100")}`}
        aria-label={t("nav.today")}
      >
        <TwinTodayCard />
        <SmartBrief />
        <div className="grid gap-4 xl:grid-cols-2">
          <TodayDecision workoutDay={today?.day ?? null} />
          <TodayLifeContext />
        </div>
      </div>
    </div>
  );
}
