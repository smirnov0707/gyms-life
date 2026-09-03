import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Apple,
  BarChart3,
  Clock,
  Dumbbell,
  Flame,
  HeartPulse,
  Play,
  Plus,
  Quote,
  Utensils,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n, type TKey } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { GlowCard } from "@/components/GlowCard";
import { MagneticButton } from "@/components/MagneticButton";
import { QuickHydrationWidget } from "@/components/QuickHydrationWidget";
import { MuscleHeatmap } from "@/components/MuscleHeatmap";
import { BodyMetricsPanel } from "@/components/BodyMetricsPanel";
import { GoalExerciseSuggestions } from "@/components/GoalExerciseSuggestions";
import { CoachDock } from "@/components/CoachDock";
import { SmartBrief } from "@/components/SmartBrief";
import { ReadinessBanner } from "@/components/ReadinessBanner";
import { ReadinessCard } from "@/components/ReadinessCard";
import { TodayDecision } from "@/components/TodayDecision";
import { TodayLifeContext } from "@/components/TodayLifeContext";
import { getTodaysWorkout } from "@/lib/todays-workout.functions";

import { useCountUp } from "@/hooks/use-count-up";
import { withTactile } from "@/lib/tactile";
import { parseStoredTrainingPlan } from "@/lib/training-plan.schema";
import { useLocalizedPlan } from "@/lib/use-localized-plan";
import { useLocalizedMealPlan } from "@/lib/use-localized-meal-plan";
import { parseStoredMealPlan } from "@/lib/meal-plan.schema";
import { dailyMotivation } from "@/lib/motivation";
import { applyAdaptation, getAppliedAdaptation, loadModifierFor } from "@/lib/readiness-adapt";
import { browserTimeZone, dayInTimeZone } from "@/lib/local-day";

function ReadinessRing({ score }: { score: number }) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, score)) / 100);
  const tone = score >= 80 ? "text-primary" : score >= 55 ? "text-accent" : "text-destructive";
  return (
    <div className="relative grid size-14 place-items-center">
      <svg className="absolute inset-0 size-14 -rotate-90">
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
          className={`${tone} transition-all duration-700`}
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

function StatBox({
  label,
  value,
  Icon,
  raw,
  suffix = "",
}: {
  label: string;
  value: string;
  Icon: typeof Flame;
  raw?: number;
  suffix?: string;
}) {
  const animated = useCountUp(raw ?? 0, 1200);
  return (
    <GlowCard className="panel lift flex items-center gap-4 p-5">
      <span className="grid size-11 place-items-center rounded-xl bg-primary/12 text-primary">
        <Icon className="size-5" />
      </span>
      <div>
        <div className="text-display text-3xl leading-none">
          {raw !== undefined ? `${animated.toLocaleString("lt-LT")}${suffix}` : value}
        </div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      </div>
    </GlowCard>
  );
}

/** The single authenticated overview — shared by "/" and "/app" so both look identical. */
export function Overview() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const timeZone = browserTimeZone();
  const localDay = dayInTimeZone(new Date(), timeZone);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, weight_kg, goal")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: plan, isLoading } = useQuery({
    queryKey: ["active-plan", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("plans")
        .select("*")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
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

  const { data: sessions } = useQuery({
    queryKey: ["sessions", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("workout_sessions")
        .select("id, day_index, started_at, total_volume, title")
        .eq("user_id", user!.id)
        .not("finished_at", "is", null)
        .order("started_at", { ascending: false })
        .limit(60);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: checkin } = useQuery({
    queryKey: ["today-checkin", user?.id, localDay],
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_checkins")
        .select("load_modifier, readiness_score, checkin_on")
        .eq("user_id", user!.id)
        .eq("checkin_on", localDay)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: savedMeal } = useQuery({
    queryKey: ["meal-plan", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("meal_plans")
        .select("id, data, lang, created_at")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: supplements } = useQuery({
    queryKey: ["supplements", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("supplements")
        .select("name, dose, category, times_per_day, preferred_time, is_active")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: nutritionToday } = useQuery({
    queryKey: ["nutrition-today", user?.id, localDay],
    queryFn: async () => {
      const { data } = await supabase
        .from("nutrition_logs")
        .select("calories")
        .eq("user_id", user!.id)
        .eq("logged_on", localDay);
      return data ?? [];
    },
    enabled: !!user,
  });

  const kcalToday = Math.round(
    (nutritionToday ?? []).reduce((s, r) => s + Number(r.calories ?? 0), 0),
  );

  const savedPlan = savedMeal ? parseStoredMealPlan(savedMeal.data) : null;
  const { plan: localizedSaved } = useLocalizedMealPlan(
    savedMeal?.id,
    savedPlan,
    savedMeal?.lang ?? "lt",
  );

  const storedPlan = plan ? parseStoredTrainingPlan(plan.data) : null;
  const { plan: planData } = useLocalizedPlan(
    plan?.id,
    storedPlan ?? undefined,
    plan?.lang ?? "lt",
  );

  const readinessScore = checkin?.readiness_score != null ? Number(checkin.readiness_score) : null;
  const [adaptation, setAdaptation] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setAdaptation(getAppliedAdaptation());
    setMounted(true);
  }, []);

  const handleApplyAdaptation = () => {
    if (readinessScore == null) return;
    const modifier =
      checkin?.load_modifier != null
        ? Number(checkin.load_modifier)
        : loadModifierFor(readinessScore);
    applyAdaptation(modifier);
    setAdaptation(modifier);
    toast.success(`${t("ms.readiness.adjusted")} · ${Math.round(modifier * 100)}%`);
  };

  const motivation = dailyMotivation(
    profile?.goal as string | undefined,
    checkin?.load_modifier as number | undefined,
    lang,
  );
  const bucketColor =
    motivation.bucket === "high"
      ? "text-primary"
      : motivation.bucket === "low"
        ? "text-destructive"
        : "text-accent";

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

  const done = sessions?.length ?? 0;
  const totalVolume = (sessions ?? []).reduce((s, x) => s + Number(x.total_volume ?? 0), 0);

  const streak = useMemo(() => {
    if (!sessions?.length) return 0;
    const days = new Set(sessions.map((s) => new Date(s.started_at).toDateString()));
    let n = 0;
    const cursor = new Date();
    for (let i = 0; i < 365; i++) {
      if (days.has(cursor.toDateString())) n++;
      else if (i > 0) break;
      cursor.setDate(cursor.getDate() - 1);
    }
    return n;
  }, [sessions]);

  const today = nextWorkoutData?.status === "READY" ? nextWorkoutData.workout : undefined;

  const nextMeal = useMemo(() => {
    if (!localizedSaved?.days.length) return null;
    const now = new Date();
    const dayIndex = done % localizedSaved.days.length || 0;
    const day = localizedSaved.days[dayIndex];
    if (!day?.meals.length) return null;
    const currentSlot =
      now.getHours() < 10
        ? 0
        : now.getHours() < 13
          ? 2
          : now.getHours() < 17
            ? 3
            : now.getHours() < 20
              ? 4
              : 5;
    const meal = day.meals[currentSlot] ?? day.meals[day.meals.length - 1];
    if (!meal) return null;
    return { meal, dayTitle: day.title };
  }, [localizedSaved, done]);

  const nextSupps = useMemo(() => {
    if (!supplements?.length) return [];
    const order: Record<string, number> = {
      morning: 6,
      pre_workout: 11,
      post_workout: 14,
      evening: 18,
      bedtime: 21,
      any: 12,
    };
    return [...supplements]
      .sort((a, b) => (order[a.preferred_time] ?? 12) - (order[b.preferred_time] ?? 12))
      .slice(0, 3);
  }, [supplements]);

  const recoveryState = useMemo(() => {
    if (readinessScore == null) return null;
    if (readinessScore >= 80) return t("tl.heat.ready");
    if (readinessScore >= 55) return t("tl.heat.optimal");
    return t("tl.heat.fatigued");
  }, [readinessScore, t]);

  const anim = (delay: string) =>
    `transition-all duration-700 ${delay} ${mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`;

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  return (
    <div className="grid gap-6">
      {readinessScore != null && (
        <ReadinessBanner
          score={readinessScore}
          onApplyAdjustment={handleApplyAdaptation}
          isAdjusted={adaptation != null}
        />
      )}

      <TodayDecision workoutDay={today?.day ?? null} />

      <TodayLifeContext />

      {/* Greeting + readiness ring */}
      <section
        className={`flex flex-col justify-between gap-4 border-b border-border pb-6 md:flex-row md:items-end ${anim("")}`}
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">
            {t("dash.welcomeBack")}
          </p>
          <h1 className="mt-1 text-4xl shine-text md:text-5xl">
            {greeting}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          {planData ? (
            <>
              <p className="mt-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                {planData.title}
              </p>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{planData.summary}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">{t("ob.sub")}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-3">
          {readinessScore != null && (
            <ReadinessCard
              score={readinessScore}
              state={recoveryState}
              ring={<ReadinessRing score={readinessScore} />}
            />
          )}

          {planData && (
            <Button
              asChild
              variant="outline"
              size="default"
              className="whitespace-nowrap rounded-full px-5"
            >
              <Link to="/onboarding">{t("dash.regenerate")}</Link>
            </Button>
          )}
        </div>
      </section>

      {/* Fast, always-visible start-workout bar */}
      {today && (
        <div className="sticky top-16 z-30 -mx-1 px-1">
          <div className="panel flex flex-wrap items-center justify-between gap-3 border-primary/40 bg-background/85 p-3 backdrop-blur-xl">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
                {t("landing.cmd.todaySession")}
              </p>
              <p className="truncate text-sm font-bold">{today.title}</p>
            </div>
            <MagneticButton
              onClick={withTactile(() =>
                navigate({ to: "/workout/$day", params: { day: String(today.day) } }),
              )}
              className="press glow-ring inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground"
            >
              <Play className="size-4" /> {t("dash.start")}
            </MagneticButton>
          </div>
        </div>
      )}

      {/* Coach daily brief — first, it drives the whole day */}
      <div className={anim("delay-100")}>
        <SmartBrief workoutDay={today?.day ?? null} />
      </div>

      {/* Live stats */}
      <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-5 ${anim("delay-150")}`}>
        <StatBox label={t("dash.streak")} value={`${streak} ${t("dash.days")}`} Icon={Flame} />
        <StatBox label={t("dash.sessions")} value={String(done)} Icon={Dumbbell} raw={done} />
        <StatBox
          label={t("dash.volume")}
          value={`${Math.round(totalVolume).toLocaleString("lt-LT")} kg`}
          Icon={BarChart3}
          raw={Math.round(totalVolume)}
          suffix=" kg"
        />
        <StatBox
          label={`${t("nut.today")} · ${t("nut.kcal")}`}
          value={String(kcalToday)}
          Icon={Apple}
          raw={kcalToday}
        />
        <StatBox
          label={t("landing.cmd.readiness")}
          value={readinessScore != null ? `${readinessScore}/100` : "—"}
          Icon={HeartPulse}
        />
      </div>

      {/* Compact motivation strip */}
      <GlowCard className={`panel relative overflow-hidden p-5 ${anim("delay-200")}`}>
        <div className="hairline absolute inset-x-0 top-0" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <p className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-primary">
              <Quote className="size-3.5" /> {t("mot.title")}
            </p>
            <h2 className="mt-1 text-2xl leading-snug md:text-3xl">{motivation.headline}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{motivation.body}</p>
            <p className="mt-1 text-[11px] uppercase tracking-widest text-muted-foreground">
              {t("mot.focus")}: <span className="text-foreground">{motivation.focus}</span>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className={`text-display text-4xl leading-none ${bucketColor}`}>
                {motivation.loadPct}%
              </div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {t("mot.load")}
              </div>
            </div>
            {!checkin && (
              <Button asChild variant="outline" size="sm" className="rounded-full">
                <Link to="/readiness">
                  <HeartPulse className="mr-1 size-3.5" /> {t("mot.checkin")}
                </Link>
              </Button>
            )}
          </div>
        </div>
      </GlowCard>

      {/* Interactive coach dock */}
      <div className={anim("delay-300")}>
        <CoachDock progression={planData?.progression} nutrition={planData?.nutrition} />
      </div>

      {/* Today + hydration/supplements */}
      <div className="grid gap-6 md:grid-cols-12">
        <div className={`md:col-span-8 ${anim("delay-200")}`}>
          <GlowCard className="panel relative h-full overflow-hidden p-6 md:p-8">
            <div className="grain-hero pointer-events-none absolute inset-0 opacity-40" />
            <div className="relative z-10">
              {today ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 break-words text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      {planData?.title}
                    </p>
                    <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-tighter text-primary">
                      {t("landing.cmd.todaySession")}
                    </span>
                  </div>
                  <h2 className="mt-2 break-words text-2xl leading-tight md:text-4xl">
                    {today.title}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {today.focus} · {today.exercises.length} {t("plan.exercises")} ·{" "}
                    {today.estimated_minutes} {t("plan.min")}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {today.exercises.map((e) => (
                      <span
                        key={e.slug}
                        className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-semibold"
                      >
                        {e.name} · {e.sets}×{e.reps}
                      </span>
                    ))}
                  </div>
                  <MagneticButton
                    onClick={withTactile(() =>
                      navigate({ to: "/workout/$day", params: { day: String(today.day) } }),
                    )}
                    className="press glow-ring mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 text-sm font-bold text-primary-foreground"
                  >
                    <Play className="size-4" /> {t("dash.start")}
                  </MagneticButton>
                </>
              ) : nextWorkoutData?.status === "WEEKLY_TARGET_REACHED" ? (
                <div className="grid place-items-center gap-4 py-12 text-center">
                  <Dumbbell className="size-8 text-primary" />
                  <h2 className="text-2xl">Savaitės treniruočių tikslas pasiektas</h2>
                  <p className="max-w-md text-sm text-muted-foreground">
                    Per paskutines 7 dienas užbaigei {nextWorkoutData.completedSessionsLast7Days} iš{" "}
                    {nextWorkoutData.plan.daysPerWeek} suplanuotų sesijų. Kita programos diena
                    lauks, kai vėl būsi pasiruošęs.
                  </p>
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="rounded-full px-7 font-bold"
                  >
                    <Link to="/training">Peržiūrėti programą</Link>
                  </Button>
                </div>
              ) : planData ? (
                <div className="grid place-items-center gap-4 py-12 text-center">
                  <Dumbbell className="size-8 text-primary" />
                  <h2 className="text-2xl">Tikriname kitą treniruotę</h2>
                  <p className="max-w-md text-sm text-muted-foreground">
                    Programos diena bus rodoma pagal tavo faktinę treniruočių eigą.
                  </p>
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="rounded-full px-7 font-bold"
                  >
                    <Link to="/training">Peržiūrėti programą</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid place-items-center gap-4 py-12 text-center">
                  <Dumbbell className="size-8 text-primary" />
                  <h2 className="text-2xl">{t("dash.noplan")}</h2>
                  <p className="max-w-md text-sm text-muted-foreground">{t("ob.sub")}</p>
                  <Button asChild size="lg" className="glow-ring rounded-full px-7 font-bold">
                    <Link to="/onboarding">{t("dash.noplanCta")}</Link>
                  </Button>
                </div>
              )}
            </div>
            <div className="pointer-events-none absolute -bottom-10 -right-10 size-64 rounded-full bg-primary/5 blur-3xl" />
          </GlowCard>
        </div>

        <div className={`flex flex-col gap-6 md:col-span-4 ${anim("delay-300")}`}>
          <QuickHydrationWidget
            targetMl={
              profile?.weight_kg
                ? Math.max(1500, Math.round((Number(profile.weight_kg) * 35) / 100) * 100)
                : 3000
            }
          />
          <GlowCard className="panel flex-1 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                {t("supp.title")}
              </h3>
              <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-xs">
                <Link to="/supplements">
                  <Plus className="size-3.5" /> {t("supp.add")}
                </Link>
              </Button>
            </div>
            {nextSupps.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">{t("supp.empty")}</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {nextSupps.map((s, i) => (
                  <li key={`${s.name}-${i}`} className="flex items-center gap-3">
                    <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Utensils className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.dose ? `${s.dose} · ` : ""}
                        {t(`supp.pref.${s.preferred_time}` as TKey)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </GlowCard>
        </div>

        {/* Recovery + body metrics + next meal */}
        <div className={`md:col-span-6 ${anim("delay-500")}`}>
          <MuscleHeatmap />
        </div>

        <div className={`md:col-span-3 ${anim("delay-500")}`}>
          <BodyMetricsPanel compact />
        </div>

        <div className={`md:col-span-3 ${anim("delay-700")}`}>
          <GlowCard className="panel h-full p-6">
            <div className="flex items-center gap-2">
              <Apple className="size-5 text-accent" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                {t("landing.cmd.nextMeal")}
              </h3>
            </div>
            {nextMeal ? (
              <div className="mt-5">
                <p className="text-xs font-bold uppercase tracking-widest text-accent">
                  {nextMeal.dayTitle}
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">{nextMeal.meal.name}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {Math.round(nextMeal.meal.kcal)} kcal · {t("nut.protein")}{" "}
                  {Math.round(nextMeal.meal.protein)}g · {t("nut.carbs")}{" "}
                  {Math.round(nextMeal.meal.carbs)}g · {t("nut.fat")}{" "}
                  {Math.round(nextMeal.meal.fat)}g
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="size-3.5" />
                  <span>{nextMeal.meal.minutes} min</span>
                </div>
              </div>
            ) : (
              <div className="mt-5 grid place-items-center gap-3 py-6 text-center">
                <Utensils className="size-7 text-accent" />
                <p className="text-sm text-muted-foreground">{t("mp.none")}</p>
                <Button asChild variant="outline" size="sm" className="rounded-full">
                  <Link to="/meal-plan">{t("mp.generate")}</Link>
                </Button>
              </div>
            )}
          </GlowCard>
        </div>
      </div>

      {/* Goal-based exercise suggestions */}
      <GoalExerciseSuggestions />

      {/* Week plan */}
      {planData && (
        <div className={anim("delay-700")}>
          <h2 className="text-3xl">{t("dash.week")}</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {planData.days.map((d) => (
              <Link
                key={d.day}
                to="/workout/$day"
                params={{ day: String(d.day) }}
                className="panel lift block p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">
                    {t("plan.day")} {d.day}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3" /> {d.estimated_minutes} {t("plan.min")}
                  </span>
                </div>
                <h3 className="mt-1 text-2xl">{d.title}</h3>
                <p className="text-sm text-primary">{d.focus}</p>
                <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                  {d.exercises.slice(0, 5).map((e) => (
                    <li key={e.slug}>
                      {e.name} — {e.sets}×{e.reps}
                    </li>
                  ))}
                </ul>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
