import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { browserTimeZone } from "@/lib/local-day";
import { getTodaysWorkout } from "@/lib/todays-workout.functions";
import type { TrainingPlanDay } from "@/lib/training-plan.schema";

/**
 * The session the athlete is meant to do today, listed rather than summarised.
 *
 * Everything shown is what their own programme says: exercise, sets, reps and
 * the rest interval. No load is displayed, because the programme does not
 * carry one — the weight is chosen during the session, and printing a number
 * here would be this screen inventing a prescription.
 *
 * Each way of having no session gets its own sentence. "You have no
 * programme", "this programme has nothing for today" and "you have already
 * done this week's work" are three different situations with three different
 * next steps, and a single empty panel serves none of them.
 */

function ExerciseRow({ exercise }: { exercise: TrainingPlanDay["exercises"][number] }) {
  const { t } = useI18n();
  return (
    <li className="fl-plan-exercise flex items-baseline justify-between gap-3 border-t border-border/50 py-2 first:border-t-0">
      <span className="min-w-0 flex-1">
        <span
          className="fl-plan-exercise-name block truncate text-xs font-semibold text-foreground"
          title={exercise.name}
        >
          {exercise.name}
        </span>
        {exercise.rest_seconds > 0 ? (
          <span className="fl-plan-exercise-rest block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {exercise.rest_seconds}s {t("tp.rest")}
          </span>
        ) : null}
      </span>
      <span className="shrink-0 font-display text-sm tabular-nums text-foreground">
        {exercise.sets} × {exercise.reps}
      </span>
    </li>
  );
}

function Session({ workout, day }: { workout: TrainingPlanDay; day: number }) {
  const { t } = useI18n();
  return (
    <>
      <div className="flex items-baseline justify-between gap-3 px-3">
        <p className="min-w-0 truncate text-sm font-semibold text-foreground">{workout.title}</p>
        <p className="shrink-0 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {workout.estimated_minutes} min
        </p>
      </div>
      <ul className="mt-2 px-3">
        {workout.exercises.map((exercise) => (
          <ExerciseRow key={`${exercise.slug}-${exercise.name}`} exercise={exercise} />
        ))}
      </ul>
      <div className="px-3 pb-3 pt-3">
        <Link
          to="/workout/$day"
          params={{ day: String(day) }}
          className="fl-plan-start flex min-h-11 w-full items-center justify-center rounded-full border border-primary/40 bg-primary/10 px-4 text-xs font-bold uppercase tracking-[0.14em] text-foreground transition-colors hover:bg-primary/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
          {t("tp.start")}
        </Link>
      </div>
    </>
  );
}

function Note({ children, action }: { children: string; action?: ReactNode }) {
  return (
    <div className="px-3 pb-3">
      <p className="text-xs leading-relaxed text-muted-foreground">{children}</p>
      {action}
    </div>
  );
}

export function TodaysPlanPanel() {
  const { t } = useI18n();
  const { user } = useAuth();
  const timeZone = browserTimeZone();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["todays-workout", user?.id, timeZone],
    queryFn: () => getTodaysWorkout({ data: { timeZone } }),
    enabled: !!user,
    staleTime: 60_000,
  });

  return (
    <section
      aria-label={t("tp.title")}
      className="fl-todays-plan overflow-hidden rounded-3xl border border-border bg-surface"
    >
      <header className="flex items-center gap-2 px-3 pb-2.5 pt-3">
        <ClipboardList aria-hidden="true" className="size-3.5 shrink-0 text-primary" />
        <h2 className="text-[11px] font-bold uppercase tracking-[0.22em] text-foreground">
          {t("tp.title")}
        </h2>
      </header>

      {isLoading ? (
        <Note>{t("common.loading")}</Note>
      ) : isError ? (
        // A failed read is not "you have no programme". Offering to build one
        // to somebody whose programme is sitting in the database is worse than
        // saying nothing at all.
        <Note>{t("ov.planReadFailed")}</Note>
      ) : data?.status === "READY" ? (
        <Session workout={data.workout} day={data.workout.day} />
      ) : data?.status === "WEEKLY_TARGET_REACHED" ? (
        <>
          <Note>{t("tp.weeklyDone")}</Note>
          <Session workout={data.nextWorkout} day={data.nextWorkout.day} />
        </>
      ) : data?.status === "NO_WORKOUT" ? (
        <Note>{t("tp.noWorkout")}</Note>
      ) : data?.status === "INVALID_PLAN" ? (
        <Note
          action={
            <Link
              to="/onboarding"
              className="mt-2 inline-flex min-h-11 items-center rounded-full border border-border px-4 text-xs font-semibold text-foreground transition-colors hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            >
              {t("tp.createPlan")}
            </Link>
          }
        >
          {t("tp.invalid")}
        </Note>
      ) : (
        <Note
          action={
            <Link
              to="/onboarding"
              className="mt-2 inline-flex min-h-11 items-center rounded-full border border-primary/40 bg-primary/10 px-4 text-xs font-semibold text-foreground transition-colors hover:bg-primary/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            >
              {t("tp.createPlan")}
            </Link>
          }
        >
          {t("tp.noPlan")}
        </Note>
      )}
    </section>
  );
}
