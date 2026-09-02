import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock, Dumbbell, Loader2, Weight } from "lucide-react";
import { GlowCard } from "@/components/GlowCard";
import { getWorkoutHistory } from "@/lib/workout-history.functions";

export const Route = createFileRoute("/_authenticated/history")({ component: WorkoutHistoryPage });

function WorkoutHistoryPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["workout-history"],
    queryFn: () => getWorkoutHistory({ data: { limit: 20 } }),
    staleTime: 30_000,
  });
  if (isLoading)
    return (
      <main className="mx-auto grid min-h-[60vh] place-items-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </main>
    );
  if (isError)
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <GlowCard className="panel p-6">
          <p className="text-destructive">Nepavyko įkelti treniruočių istorijos.</p>
        </GlowCard>
      </main>
    );
  const sessions = data?.sessions ?? [];
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Training</p>
        <h1 className="mt-2 text-4xl">Workout History</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tavo užbaigtos treniruotės ir realiai atlikti setai.
        </p>
      </header>
      <div className="mt-7 grid gap-4">
        {sessions.length === 0 ? (
          <GlowCard className="panel p-8 text-center">
            <Dumbbell className="mx-auto size-10 text-primary" />
            <h2 className="mt-4 text-xl font-semibold">Dar nėra užbaigtų treniruočių</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Užbaik pirmą treniruotę ir jos rezultatai atsiras čia.
            </p>
          </GlowCard>
        ) : (
          sessions.map((session) => {
            const date = new Date(session.finished_at ?? session.started_at);
            const exercises = Array.from(
              new Map(
                session.sets.filter((set) => set.done).map((set) => [set.exercise_slug, set]),
              ).values(),
            );
            return (
              <GlowCard key={session.id} className="panel p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                      <CalendarDays className="size-3.5" />
                      {date.toLocaleDateString()}
                    </p>
                    <h2 className="mt-2 text-2xl">{session.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {session.day_index === null
                        ? "Unplanned session"
                        : `Program day ${session.day_index + 1}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="size-4" />
                      {Math.round((session.duration_seconds ?? 0) / 60)} min
                    </span>
                    <span className="flex items-center gap-1">
                      <Weight className="size-4" />
                      {Number(session.total_volume ?? 0)} kg
                    </span>
                  </div>
                </div>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {exercises.map((set) => (
                    <div key={set.exercise_slug} className="rounded-lg bg-surface-2 px-4 py-3">
                      <div className="font-medium">{set.exercise_name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {
                          session.sets.filter(
                            (item) => item.exercise_slug === set.exercise_slug && item.done,
                          ).length
                        }{" "}
                        atlikti setai · paskutinis: {set.reps ?? 0} reps × {set.weight_kg ?? 0} kg
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
    </main>
  );
}
