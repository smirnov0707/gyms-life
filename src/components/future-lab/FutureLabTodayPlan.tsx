import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Clock3, Dumbbell, ShieldCheck } from "lucide-react";
import { baseLang, useI18n } from "@/lib/i18n";
import type { TodaysWorkoutState } from "@/lib/active-plan.service";

export function FutureLabTodayPlan({ state }: { state: TodaysWorkoutState | undefined }) {
  const { lang } = useI18n();
  const isEnglish = baseLang(lang) === "en";

  if (!state) {
    return (
      <section className="rounded-[1.35rem] border border-[#182846] bg-[#07111d]/88 p-4">
        <div className="h-3 w-24 animate-pulse rounded bg-white/[0.06]" />
        <div className="mt-4 h-6 w-40 animate-pulse rounded bg-white/[0.06]" />
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-8 animate-pulse rounded-lg bg-white/[0.035]" />
          ))}
        </div>
      </section>
    );
  }

  const ready = state.status === "READY";
  const workout = ready
    ? state.workout
    : state.status === "WEEKLY_TARGET_REACHED"
      ? state.nextWorkout
      : null;

  return (
    <section className="overflow-hidden rounded-[1.35rem] border border-[#182846] bg-[#07111d]/88">
      <header className="border-b border-[#16243c] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-violet-300">
              {isEnglish ? "TODAY'S PLAN" : "ŠIANDIENOS PLANAS"}
            </p>
            {workout ? (
              <p className="mt-1 truncate text-sm font-semibold text-white">{workout.title}</p>
            ) : null}
          </div>
          {workout ? (
            <span className="flex shrink-0 items-center gap-1 text-[10px] text-slate-500">
              <Clock3 className="size-3" /> {workout.estimated_minutes} min
            </span>
          ) : null}
        </div>
        {workout?.focus ? (
          <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-cyan-300/75">
            {workout.focus}
          </p>
        ) : null}
      </header>

      {workout ? (
        <div className="px-4 py-2">
          <div className="divide-y divide-white/[0.05]">
            {workout.exercises.slice(0, 5).map((exercise) => (
              <div key={exercise.slug} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0 truncate text-[11px] font-medium text-slate-200">
                  {exercise.name}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-slate-500">
                  {exercise.sets} × {exercise.reps}
                </span>
              </div>
            ))}
          </div>
          {workout.exercises.length > 5 ? (
            <p className="pb-2 text-[10px] text-slate-600">
              +{workout.exercises.length - 5} {isEnglish ? "more" : "dar"}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="px-4 py-5 text-xs leading-relaxed text-slate-500">
          {state.status === "NO_ACTIVE_PLAN"
            ? isEnglish
              ? "No active training plan yet."
              : "Aktyvaus treniruočių plano dar nėra."
            : state.status === "INVALID_PLAN"
              ? isEnglish
                ? "The active plan needs to be regenerated before it can drive Today."
                : "Aktyvų planą reikia sugeneruoti iš naujo, kad jis galėtų valdyti Today."
              : isEnglish
                ? "No workout is currently available."
                : "Šiuo metu prieinamos treniruotės nėra."}
        </div>
      )}

      <footer className="border-t border-[#16243c] p-3">
        {ready && workout ? (
          <Link
            to="/workout/$day"
            params={{ day: String(workout.day) }}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-violet-400/30 bg-violet-600/25 px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-violet-100 transition-colors hover:bg-violet-600/35"
          >
            <Dumbbell className="size-4" /> {isEnglish ? "START WORKOUT" : "PRADĖTI TRENIRUOTĘ"}
          </Link>
        ) : state.status === "WEEKLY_TARGET_REACHED" ? (
          <div className="flex items-start gap-2 rounded-xl bg-emerald-400/[0.06] px-3 py-2.5 text-[10px] leading-relaxed text-emerald-300/85">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
            {isEnglish
              ? "Your rolling 7-day training target is already complete. The next session is previewed, not prescribed for today."
              : "7 dienų treniruočių tikslas jau įvykdytas. Kita sesija rodoma peržiūrai, bet šiandien nėra rekomenduojama."}
          </div>
        ) : (
          <Link
            to={state.status === "NO_ACTIVE_PLAN" || state.status === "INVALID_PLAN" ? "/onboarding" : "/training"}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#21324f] bg-[#091321] px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-300 transition-colors hover:border-violet-400/35 hover:text-white"
          >
            {state.status === "NO_ACTIVE_PLAN" || state.status === "INVALID_PLAN"
              ? isEnglish
                ? "BUILD TRAINING PLAN"
                : "SUKURTI TRENIRUOČIŲ PLANĄ"
              : isEnglish
                ? "OPEN TRAINING"
                : "ATIDARYTI TRENIRUOTES"}
            <ArrowUpRight className="size-3.5" />
          </Link>
        )}
      </footer>
    </section>
  );
}
