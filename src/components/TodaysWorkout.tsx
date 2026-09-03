import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Clock, Dumbbell } from "lucide-react";
import { getTodaysWorkout } from "@/lib/todays-workout.functions";
import { GlowCard } from "@/components/GlowCard";
import { Button } from "@/components/ui/button";
import { browserTimeZone } from "@/lib/local-day";

export function TodaysWorkout() {
  const timeZone = browserTimeZone();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["todays-workout", timeZone],
    queryFn: () => getTodaysWorkout({ data: { timeZone } }),
    staleTime: 60_000,
  });

  if (isLoading)
    return (
      <GlowCard className="panel p-6">
        <div className="h-7 w-52 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-4 w-80 animate-pulse rounded bg-muted" />
      </GlowCard>
    );
  if (isError)
    return (
      <GlowCard className="panel p-6">
        <p className="text-sm text-destructive">Nepavyko įkelti šiandienos treniruotės.</p>
      </GlowCard>
    );
  if (!data || data.status === "NO_ACTIVE_PLAN") return null;
  if (data.status === "INVALID_PLAN")
    return (
      <GlowCard className="panel p-6">
        <p className="font-semibold">Aktyvi programa turi netinkamus duomenis.</p>
      </GlowCard>
    );
  if (data.status === "WEEKLY_TARGET_REACHED")
    return (
      <GlowCard className="panel p-6">
        <p className="font-semibold">Savaitės treniruočių tikslas pasiektas.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Per paskutines 7 dienas užbaigei {data.completedSessionsLast7Days} iš{" "}
          {data.plan.daysPerWeek} suplanuotų sesijų. Kita programos diena lauks, kai vėl būsi
          pasiruošęs.
        </p>
        <Button asChild variant="outline" className="mt-4 rounded-full">
          <Link to="/training">Peržiūrėti programą</Link>
        </Button>
      </GlowCard>
    );
  if (data.status === "NO_WORKOUT")
    return (
      <GlowCard className="panel p-6">
        <p className="font-semibold">Šiandienai treniruotė nerasta.</p>
      </GlowCard>
    );

  const workout = data.workout;
  return (
    <GlowCard className="panel overflow-hidden p-0">
      <div className="p-6 md:p-7">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">
              Today's Workout
            </p>
            <h2 className="mt-2 text-3xl">{workout.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{workout.focus}</p>
          </div>
          <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Dumbbell className="size-6" />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clock className="size-4" />
            {workout.estimated_minutes} min
          </span>
          <span>{workout.exercises.length} pratimai</span>
          <span>Diena {workout.day}</span>
        </div>
      </div>
      <div className="border-t border-border/60 p-6 md:p-7">
        <div className="space-y-2">
          {workout.exercises.map((exercise, index) => (
            <div
              key={`${exercise.slug}-${index}`}
              className="flex items-center justify-between gap-4 rounded-xl bg-surface-2 px-4 py-3"
            >
              <div>
                <span className="text-xs text-muted-foreground">{index + 1}</span>
                <span className="ml-3 font-medium">{exercise.name}</span>
              </div>
              <span className="shrink-0 text-sm font-semibold text-primary">
                {exercise.sets} × {exercise.reps}
              </span>
            </div>
          ))}
        </div>
        <Button asChild size="lg" className="mt-6 w-full rounded-none font-bold hard-shadow">
          <Link to="/app">
            Review today's decision <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
      </div>
    </GlowCard>
  );
}
