import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock, Dumbbell, Loader2, Weight } from "lucide-react";
import { GlowCard } from "@/components/GlowCard";
import { JournalIntelligence } from "@/components/future-lab/JournalIntelligence";
import { getWorkoutHistory } from "@/lib/workout-history.functions";

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

function WorkoutHistoryPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["workout-history"],
    queryFn: () => getWorkoutHistory({ data: { limit: 20 } }),
    staleTime: 30_000,
  });
  return (
    <main className="mx-auto max-w-[1480px] space-y-4">
      <JournalIntelligence />
      <section className="rounded-[1.75rem] border border-[#182846] bg-[#07111d]/65 p-5 sm:p-6">
        <header className="border-b border-[#17243b] pb-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-cyan-300/75">
            RECORDED TRAINING
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Workout timeline</h2>
          <p className="mt-2 text-xs text-slate-500">
            Tavo užbaigtos treniruotės ir realiai atlikti setai. Tai istorija, ne AI interpretacija.
          </p>
        </header>
        {isLoading ? (
          <div className="grid min-h-48 place-items-center">
            <Loader2 className="size-7 animate-spin text-violet-300" />
          </div>
        ) : isError ? (
          <GlowCard className="panel mt-5 p-6">
            <p className="text-destructive">Nepavyko įkelti treniruočių istorijos.</p>
          </GlowCard>
        ) : (
          <div className="mt-5 grid gap-3">
            {(data?.sessions ?? []).length === 0 ? (
              <GlowCard className="panel p-8 text-center">
                <Dumbbell className="mx-auto size-10 text-primary" />
                <h3 className="mt-4 text-xl font-semibold">Dar nėra užbaigtų treniruočių</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Užbaik pirmą treniruotę ir jos rezultatai atsiras čia.
                </p>
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
                          {date.toLocaleDateString()}
                        </p>
                        <h3 className="mt-2 text-xl">{session.session.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {session.session.dayIndex === null
                            ? "Unplanned session"
                            : `Program day ${session.session.dayIndex + 1}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="size-4" />
                          {Math.round((session.session.durationSeconds ?? 0) / 60)} min
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
                            atlikti setai · paskutinis: {set.reps ?? 0} reps × {set.weightKg ?? 0}{" "}
                            kg{set.rpe != null ? ` · RPE ${set.rpe}` : ""}
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
    </main>
  );
}
