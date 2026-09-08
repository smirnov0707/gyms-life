import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock, Dumbbell, Loader2, Weight } from "lucide-react";
import { GlowCard } from "@/components/GlowCard";
import { JournalIntelligence } from "@/components/future-lab/JournalIntelligence";
import { getWorkoutHistory } from "@/lib/workout-history.functions";
import { useAuth } from "@/lib/auth";
import { baseLang, formatLocale, useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "Journal — GYMS.LIFE FUTURE LAB" },
      {
        name: "description",
        content: "Hypotheses, discoveries, decisions and recorded workout history.",
      },
    ],
  }),
  component: WorkoutHistoryPage,
});

export function WorkoutHistoryPage() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const english = baseLang(lang) === "en";
  const copy = english
    ? {
        eyebrow: "Recorded training",
        title: "Workout timeline",
        description: "Your completed workouts and recorded sets.",
        loading: "Loading workout history…",
        unavailable: "Workout history could not be loaded.",
        empty: "No completed workouts yet",
        emptyHint: "Complete your first workout to see its results here.",
        unplanned: "Unplanned session",
        day: "Program day",
        sets: "completed sets · last",
        reps: "reps",
      }
    : {
        eyebrow: "Užregistruotos treniruotės",
        title: "Treniruočių istorija",
        description: "Tavo užbaigtos treniruotės ir užregistruoti setai.",
        loading: "Įkeliama treniruočių istorija…",
        unavailable: "Nepavyko įkelti treniruočių istorijos.",
        empty: "Dar nėra užbaigtų treniruočių",
        emptyHint: "Užbaik pirmą treniruotę ir jos rezultatai atsiras čia.",
        unplanned: "Neplanuota sesija",
        day: "Programos diena",
        sets: "atlikti setai · paskutinis",
        reps: "kart.",
      };
  const { data, isLoading, isError } = useQuery({
    queryKey: ["workout-history", user?.id],
    queryFn: () => getWorkoutHistory({ data: { limit: 20 } }),
    enabled: !!user,
    staleTime: 30_000,
  });
  return (
    <div className="mx-auto max-w-[1480px] space-y-4">
      <JournalIntelligence />
      <section className="rounded-xl border border-border bg-surface/90 p-4 sm:p-5">
        <header className="border-b border-border pb-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-cyan-300 light:text-cyan-700">
            {copy.eyebrow}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-foreground">{copy.title}</h2>
          <p className="mt-2 text-xs text-muted-foreground">{copy.description}</p>
        </header>
        {isLoading || (!data && !isError) ? (
          <div
            role="status"
            className="flex min-h-32 items-center justify-center gap-2 text-xs text-muted-foreground"
          >
            <Loader2 aria-hidden="true" className="size-5 animate-spin text-violet-300" />
            {copy.loading}
          </div>
        ) : isError ? (
          <GlowCard className="panel mt-5 p-6">
            <p role="alert" className="text-destructive">
              {copy.unavailable}
            </p>
          </GlowCard>
        ) : (
          <div className="mt-5 grid gap-3">
            {(data?.sessions ?? []).length === 0 ? (
              <GlowCard className="panel p-8 text-center">
                <Dumbbell className="mx-auto size-10 text-primary" />
                <h3 className="mt-4 text-xl font-semibold">{copy.empty}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{copy.emptyHint}</p>
              </GlowCard>
            ) : (
              (data?.sessions ?? []).map((session) => {
                const date = new Date(session.session.finishedAt);
                const exercises = Array.from(
                  new Map(
                    session.sets.filter((set) => set.done).map((set) => [set.exerciseSlug, set]),
                  ).values(),
                );
                return (
                  <GlowCard key={session.session.id} className="panel p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                          <CalendarDays className="size-3.5" />
                          {date.toLocaleDateString(formatLocale(lang))}
                        </p>
                        <h3 className="mt-2 text-xl">{session.session.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {session.session.dayIndex === null
                            ? copy.unplanned
                            : `${copy.day} ${session.session.dayIndex + 1}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="size-4" />
                          {session.session.durationSeconds === null
                            ? "—"
                            : Math.round(session.session.durationSeconds / 60)}{" "}
                          min
                        </span>
                        <span className="flex items-center gap-1">
                          <Weight className="size-4" />
                          {session.session.totalVolume} kg
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {exercises.map((set) => (
                        <div key={set.exerciseSlug} className="rounded-lg bg-surface-2 px-4 py-3">
                          <div className="font-medium">{set.exerciseName}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {
                              session.sets.filter(
                                (item) => item.exerciseSlug === set.exerciseSlug && item.done,
                              ).length
                            }{" "}
                            {copy.sets}: {set.reps ?? "—"} {copy.reps} × {set.weightKg ?? "—"} kg
                            {set.rpe != null ? ` · RPE ${set.rpe}` : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  </GlowCard>
                );
              })
            )}
          </div>
        )}
      </section>
    </div>
  );
}
