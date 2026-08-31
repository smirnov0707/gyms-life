import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Clock, Dumbbell, Loader2, TimerReset, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlowCard } from "@/components/GlowCard";
import { getTodaysWorkout } from "@/lib/todays-workout.functions";
import { startWorkout } from "@/lib/start-workout.functions";
import { logWorkoutSet } from "@/lib/set-log.functions";
import { finishWorkout } from "@/lib/finish-workout.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/workout/$day")({ component: WorkoutPage });

function WorkoutPage() {
  const { day } = Route.useParams();
  const dayNumber = Number(day);
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [setNumber, setSetNumber] = useState(1);
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");
  const [rpe, setRpe] = useState("");
  const [rest, setRest] = useState(0);
  const [finished, setFinished] = useState(false);
  const [summary, setSummary] = useState<{ duration: number; volume: number } | null>(null);

  const workoutQuery = useQuery({ queryKey: ["workout", dayNumber], queryFn: () => getTodaysWorkout({ data: { day: dayNumber } }), enabled: Number.isInteger(dayNumber) && dayNumber > 0 });

  const startMutation = useMutation({
    mutationFn: () => startWorkout({ data: { day: dayNumber } }),
    onSuccess: (result) => {
      setSessionId(result.session.id);
      const firstIncomplete = result.workout.exercises.findIndex((exercise) => {
        const completed = result.logs.filter((log) => log.exercise_slug === exercise.slug && log.done).length;
        return completed < exercise.sets;
      });
      const nextIndex = firstIncomplete === -1 ? result.workout.exercises.length - 1 : firstIncomplete;
      const exercise = result.workout.exercises[nextIndex];
      const completed = result.logs.filter((log) => log.exercise_slug === exercise?.slug && log.done).length;
      setExerciseIndex(Math.max(0, nextIndex));
      setSetNumber(Math.min((completed || 0) + 1, exercise?.sets ?? 1));
      if (result.resumed) toast.info("Tęsiame nebaigtą treniruotę.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Nepavyko pradėti treniruotės"),
  });

  const logMutation = useMutation({
    mutationFn: () => {
      if (!sessionId) throw new Error("Workout session is not started.");
      const exercise = workoutQuery.data?.status === "READY" ? workoutQuery.data.workout.exercises[exerciseIndex] : null;
      if (!exercise) throw new Error("Exercise not found.");
      return logWorkoutSet({ data: { sessionId, exerciseSlug: exercise.slug, exerciseName: exercise.name, setNumber, reps: reps ? Number(reps) : null, weightKg: weight ? Number(weight) : null, rpe: rpe ? Number(rpe) : null, done: true } });
    },
    onSuccess: () => {
      setReps("");
      setWeight("");
      setRpe("");
      setRest(workoutQuery.data?.status === "READY" ? workoutQuery.data.workout.exercises[exerciseIndex]?.rest_seconds ?? 0 : 0);
      setSetNumber((n) => n + 1);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Nepavyko išsaugoti seto"),
  });

  const finishMutation = useMutation({
    mutationFn: () => {
      if (!sessionId) throw new Error("Workout session is not started.");
      return finishWorkout({ data: { sessionId } });
    },
    onSuccess: (result) => {
      setFinished(true);
      setSummary({ duration: result.session.duration_seconds ?? 0, volume: Number(result.session.total_volume ?? 0) });
      toast.success("Treniruotė užbaigta!");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Nepavyko užbaigti treniruotės"),
  });

  useEffect(() => {
    if (rest <= 0) return;
    const timer = window.setInterval(() => setRest((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [rest]);

  const workout = workoutQuery.data?.status === "READY" ? workoutQuery.data.workout : null;
  const exercise = workout?.exercises[exerciseIndex];
  const totalSets = exercise?.sets ?? 0;
  const currentSetComplete = setNumber > totalSets;
  const lastExercise = Boolean(workout && exerciseIndex === workout.exercises.length - 1);
  const progress = useMemo(() => workout ? Math.round(((exerciseIndex + (currentSetComplete ? 1 : (setNumber - 1) / Math.max(1, totalSets))) / workout.exercises.length) * 100) : 0, [workout, exerciseIndex, currentSetComplete, setNumber, totalSets]);

  if (workoutQuery.isLoading) return <main className="mx-auto grid min-h-[70vh] max-w-3xl place-items-center"><Loader2 className="size-8 animate-spin text-primary" /></main>;
  if (workoutQuery.isError || !workout) return <main className="mx-auto max-w-3xl px-4 py-8"><GlowCard className="panel p-6"><p className="text-destructive">Treniruotės nepavyko įkelti.</p><Button className="mt-4" onClick={() => navigate({ to: "/training" })}>Grįžti į Training Hub</Button></GlowCard></main>;
  if (finished && summary) return <main className="mx-auto max-w-3xl px-4 py-8"><GlowCard className="panel p-8 text-center"><Trophy className="mx-auto size-14 text-primary" /><p className="mt-5 text-xs font-bold uppercase tracking-[0.24em] text-primary">Workout Complete</p><h1 className="mt-2 text-4xl">Puiki treniruotė!</h1><div className="mt-7 grid gap-4 sm:grid-cols-2"><div className="rounded-xl bg-surface-2 p-5"><div className="text-3xl font-bold">{Math.floor(summary.duration / 60)} min</div><div className="text-xs uppercase tracking-widest text-muted-foreground">trukmė</div></div><div className="rounded-xl bg-surface-2 p-5"><div className="text-3xl font-bold">{summary.volume} kg</div><div className="text-xs uppercase tracking-widest text-muted-foreground">total volume</div></div></div><Button className="mt-7 w-full" onClick={() => navigate({ to: "/training" })}>Grįžti į Training Hub</Button></GlowCard></main>;

  return <main className="mx-auto max-w-3xl px-4 py-6 pb-12"><div className="mb-5 flex items-center justify-between gap-3"><Button variant="ghost" onClick={() => navigate({ to: "/training" })}><ArrowLeft className="mr-1 size-4" /> Training Hub</Button><span className="flex items-center gap-1.5 text-sm text-muted-foreground"><Clock className="size-4" /> {workout.estimated_minutes} min</span></div><GlowCard className="panel p-6 md:p-8"><p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Workout Session</p><h1 className="mt-2 text-4xl">{workout.title}</h1><p className="mt-1 text-sm text-muted-foreground">{workout.focus}</p><div className="mt-5 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} /></div>{!sessionId ? <div className="mt-8 text-center"><Dumbbell className="mx-auto size-12 text-primary" /><p className="mt-4 text-sm text-muted-foreground">Pradėsime realią treniruotės sesiją ir išsaugosime kiekvieną atliktą setą.</p><Button size="lg" className="mt-5 w-full rounded-none font-bold hard-shadow" onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>{startMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}Start Workout</Button></div> : <div className="mt-8"><div className="rounded-xl border border-border p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-muted-foreground">Exercise {exerciseIndex + 1} / {workout.exercises.length}</p><h2 className="mt-1 text-2xl">{exercise?.name}</h2><p className="mt-1 text-sm text-muted-foreground">Plan: {exercise?.sets} × {exercise?.reps}</p></div><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">Set {Math.min(setNumber, totalSets)} / {totalSets}</span></div>{currentSetComplete ? <div className="mt-6"><div className="grid place-items-center rounded-xl bg-primary/10 p-6"><Check className="size-8 text-primary" /><p className="mt-2 font-semibold">Exercise complete</p></div>{lastExercise ? <><p className="mt-5 text-center text-sm text-muted-foreground">Visi pratimai atlikti. Gali užbaigti treniruotę.</p><Button size="lg" className="mt-5 w-full rounded-none font-bold hard-shadow" onClick={() => finishMutation.mutate()} disabled={finishMutation.isPending}>{finishMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Trophy className="mr-2 size-4" />}Finish Workout</Button></> : <Button className="mt-5 w-full" onClick={() => { setExerciseIndex((i) => i + 1); setSetNumber(1); setRest(0); }}>Next Exercise</Button>}</div> : <><div className="mt-6 grid gap-3 sm:grid-cols-3"><div><label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reps</label><Input className="mt-1" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} placeholder={String(exercise?.reps ?? "")} /></div><div><label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Weight kg</label><Input className="mt-1" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="0" /></div><div><label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">RPE</label><Input className="mt-1" inputMode="decimal" value={rpe} onChange={(e) => setRpe(e.target.value)} placeholder="1–10" /></div></div><Button className="mt-5 w-full rounded-none font-bold" disabled={logMutation.isPending || !reps} onClick={() => logMutation.mutate()}>{logMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Check className="mr-2 size-4" />}Complete Set</Button>{rest > 0 && <div className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-primary"><TimerReset className="size-4" /> Rest: {rest}s</div>}</>}</div></div>}</GlowCard></main>;
}
