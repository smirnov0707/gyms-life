import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Clock, Dumbbell, Loader2, TimerReset, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlowCard } from "@/components/GlowCard";
import { getTodaysWorkout } from "@/lib/todays-workout.functions";
import { startWorkout } from "@/lib/start-workout.functions";
import { logWorkoutSet } from "@/lib/set-log.functions";
import { finishWorkout } from "@/lib/finish-workout.functions";
import {
  flushOfflineWorkoutSets,
  hasQueuedWorkoutSets,
  isNetworkUnavailable,
  queueWorkoutSet,
  type WorkoutSetSync,
} from "@/lib/offline-store";
import { toast } from "sonner";
import type { TrainingPlanDay } from "@/lib/training-plan.schema";
import type { ExerciseTrainingGuidance } from "@/lib/training-guidance.engine";
import type { WorkoutTrainingGuidance } from "@/lib/training-guidance.service";
import { errorMessage } from "@/lib/error-message";

export const Route = createFileRoute("/_authenticated/workout/$day")({ component: WorkoutPage });

function parseOptionalWorkoutNumber(value: string, label: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) throw new Error(label + " turi būti skaičius.");
  return parsed;
}

function coachMessage(guidance: ExerciseTrainingGuidance): string {
  const previous = guidance.previous
    ? "Paskutinį kartą: " +
      guidance.previous.weightKg +
      " kg × " +
      (guidance.previous.reps ?? "—") +
      (guidance.previous.rpe !== null ? ", RPE " + guidance.previous.rpe : "") +
      ". "
    : "";

  if (guidance.action === "INCREASE_LOAD") {
    return (
      previous +
      "Visos darbinės serijos pasiekė viršutinę pakartojimų ribą su kontroliuojamu RPE. Siūlomas kitas svoris: " +
      guidance.suggestedWeightKg +
      " kg."
    );
  }
  if (guidance.reason === "RECOVERY_REDUCTION") {
    return (
      previous +
      "Šiandienos pasirengimas prašo tausoti atsistatymą. Siūlomas svoris: " +
      guidance.suggestedWeightKg +
      " kg; sumažintas serijų skaičius jau pritaikytas."
    );
  }
  if (guidance.reason === "HIGH_EFFORT_MISSED_TARGET") {
    return (
      previous +
      "Praeitą kartą tikslas nebuvo pasiektas su aukštu RPE. Siūlomas technikos ir pakartojimų svoris: " +
      guidance.suggestedWeightKg +
      " kg."
    );
  }
  if (guidance.action === "MAINTAIN_LOAD") {
    return (
      previous +
      "Laikyk šį svorį, kol saugiai pasieksi viršutinę pakartojimų ribą visose darbinėse serijose."
    );
  }
  return "Pirmiausia užregistruok svorį, pakartojimus ir RPE — tuomet treneris pasiūlys kitą konkretų žingsnį.";
}

function WorkoutPage() {
  const { day } = Route.useParams();
  const dayNumber = Number(day);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeWorkout, setActiveWorkout] = useState<TrainingPlanDay | null>(null);
  const [workoutGuidance, setWorkoutGuidance] = useState<WorkoutTrainingGuidance | null>(null);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [setNumber, setSetNumber] = useState(1);
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");
  const [rpe, setRpe] = useState("");
  const [rest, setRest] = useState(0);
  const [finished, setFinished] = useState(false);
  const [summary, setSummary] = useState<{ duration: number; volume: number } | null>(null);

  const syncQueuedSets = useCallback(async () => {
    const result = await flushOfflineWorkoutSets((input) => logWorkoutSet({ data: input }));
    if (result.synced > 0) {
      toast.success(
        result.synced === 1
          ? "Išsaugota 1 anksčiau neprisijungus įrašyta serija."
          : `Išsaugotos ${result.synced} anksčiau neprisijungus įrašytos serijos.`,
      );
    }
    return result;
  }, []);

  const workoutQuery = useQuery({
    queryKey: ["workout", dayNumber],
    queryFn: () => getTodaysWorkout({ data: { day: dayNumber } }),
    enabled: Number.isInteger(dayNumber) && dayNumber > 0,
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      await syncQueuedSets();
      return startWorkout({ data: { day: dayNumber } });
    },
    onSuccess: (result) => {
      setSessionId(result.session.id);
      setActiveWorkout(result.workout);
      setWorkoutGuidance(result.guidance);
      const firstIncomplete = result.workout.exercises.findIndex((exercise) => {
        const completed = result.logs.filter(
          (log) => log.exercise_slug === exercise.slug && log.done,
        ).length;
        return completed < exercise.sets;
      });
      const nextIndex =
        firstIncomplete === -1 ? result.workout.exercises.length - 1 : firstIncomplete;
      const exercise = result.workout.exercises[nextIndex];
      const completed = result.logs.filter(
        (log) => log.exercise_slug === exercise?.slug && log.done,
      ).length;
      setExerciseIndex(Math.max(0, nextIndex));
      setSetNumber(Math.min((completed || 0) + 1, exercise?.sets ?? 1));
      if (result.resumed) toast.info("Tęsiame nebaigtą treniruotę.");
    },
    onError: (error) => toast.error(errorMessage(error, "Nepavyko pradėti treniruotės")),
  });

  const buildSetInput = (): WorkoutSetSync => {
    if (!sessionId) throw new Error("Workout session is not started.");
    const exercise =
      workoutQuery.data?.status === "READY"
        ? workoutQuery.data.workout.exercises[exerciseIndex]
        : null;
    if (!exercise) throw new Error("Exercise not found.");

    return {
      sessionId,
      exerciseSlug: exercise.slug,
      exerciseName: exercise.name,
      setNumber,
      reps: parseOptionalWorkoutNumber(reps, "Pakartojimų skaičius"),
      weightKg: parseOptionalWorkoutNumber(weight, "Svoris"),
      rpe: parseOptionalWorkoutNumber(rpe, "RPE"),
      done: true,
    };
  };

  const logMutation = useMutation({
    mutationFn: async () => {
      const input = buildSetInput();
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        queueWorkoutSet(input);
        return { queued: true };
      }

      try {
        const result = await logWorkoutSet({ data: input });
        return { ...result, queued: false };
      } catch (error) {
        if (!isNetworkUnavailable(error)) throw error;
        queueWorkoutSet(input);
        return { queued: true };
      }
    },
    onSuccess: (result) => {
      setReps("");
      setWeight("");
      setRpe("");
      setRest(
        workoutQuery.data?.status === "READY"
          ? (workoutQuery.data.workout.exercises[exerciseIndex]?.rest_seconds ?? 0)
          : 0,
      );
      setSetNumber((n) => n + 1);
      if (result.queued) {
        toast.info("Serija išsaugota šiame įrenginyje ir bus persiųsta atkūrus ryšį.");
      }
    },
    onError: (error) => toast.error(errorMessage(error, "Nepavyko išsaugoti seto")),
  });

  const finishMutation = useMutation({
    mutationFn: async () => {
      if (!sessionId) throw new Error("Workout session is not started.");
      if (hasQueuedWorkoutSets(sessionId)) {
        await syncQueuedSets();
        if (hasQueuedWorkoutSets(sessionId)) {
          throw new Error(
            "Atkurkite ryšį, kad prieš užbaigiant treniruotę būtų išsaugotos serijos.",
          );
        }
      }
      return finishWorkout({ data: { sessionId } });
    },
    onSuccess: async (result) => {
      setFinished(true);
      setSummary({
        duration: result.session.durationSeconds ?? 0,
        volume: result.session.totalVolume,
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["sessions"] }),
        qc.invalidateQueries({ queryKey: ["sessions-all"] }),
        qc.invalidateQueries({ queryKey: ["performance-overview"] }),
        qc.invalidateQueries({ queryKey: ["volume-trend"] }),
        qc.invalidateQueries({ queryKey: ["strength-trend"] }),
        qc.invalidateQueries({ queryKey: ["progress-intelligence"] }),
        qc.invalidateQueries({ queryKey: ["injury-risk"] }),
      ]);
      toast.success("Treniruotė užbaigta!");
    },
    onError: (error) => toast.error(errorMessage(error, "Nepavyko užbaigti treniruotės")),
  });

  useEffect(() => {
    if (rest <= 0) return;
    const timer = window.setInterval(() => setRest((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [rest]);

  useEffect(() => {
    void syncQueuedSets();
    const onOnline = () => void syncQueuedSets();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [syncQueuedSets]);

  const workout =
    activeWorkout ?? (workoutQuery.data?.status === "READY" ? workoutQuery.data.workout : null);
  const exercise = workout?.exercises[exerciseIndex];
  const exerciseGuidance = workoutGuidance?.exercises.find(
    (guidance) => guidance.exerciseSlug === exercise?.slug,
  );
  const totalSets = exercise?.sets ?? 0;
  const currentSetComplete = setNumber > totalSets;
  const lastExercise = Boolean(workout && exerciseIndex === workout.exercises.length - 1);
  const progress = useMemo(
    () =>
      workout
        ? Math.round(
            ((exerciseIndex + (currentSetComplete ? 1 : (setNumber - 1) / Math.max(1, totalSets))) /
              workout.exercises.length) *
              100,
          )
        : 0,
    [workout, exerciseIndex, currentSetComplete, setNumber, totalSets],
  );

  if (workoutQuery.isLoading)
    return (
      <main className="mx-auto grid min-h-[70vh] max-w-3xl place-items-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </main>
    );
  if (workoutQuery.isError || !workout)
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <GlowCard className="panel p-6">
          <p className="text-destructive">Treniruotės nepavyko įkelti.</p>
          <Button className="mt-4" onClick={() => navigate({ to: "/training" })}>
            Grįžti į Training Hub
          </Button>
        </GlowCard>
      </main>
    );
  if (finished && summary)
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <GlowCard className="panel p-8 text-center">
          <Trophy className="mx-auto size-14 text-primary" />
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.24em] text-primary">
            Workout Complete
          </p>
          <h1 className="mt-2 text-4xl">Puiki treniruotė!</h1>
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-surface-2 p-5">
              <div className="text-3xl font-bold">{Math.floor(summary.duration / 60)} min</div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">trukmė</div>
            </div>
            <div className="rounded-xl bg-surface-2 p-5">
              <div className="text-3xl font-bold">{summary.volume} kg</div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                total volume
              </div>
            </div>
          </div>
          <Button className="mt-7 w-full" onClick={() => navigate({ to: "/training" })}>
            Grįžti į Training Hub
          </Button>
        </GlowCard>
      </main>
    );

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 pb-12">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => navigate({ to: "/training" })}>
          <ArrowLeft className="mr-1 size-4" /> Training Hub
        </Button>
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="size-4" /> {workout.estimated_minutes} min
        </span>
      </div>
      <GlowCard className="panel p-6 md:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">
          Workout Session
        </p>
        <h1 className="mt-2 text-4xl">{workout.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{workout.focus}</p>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
        {!sessionId ? (
          <div className="mt-8 text-center">
            <Dumbbell className="mx-auto size-12 text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">
              Pradėsime realią treniruotės sesiją ir išsaugosime kiekvieną atliktą setą.
            </p>
            <Button
              size="lg"
              className="mt-5 w-full rounded-none font-bold hard-shadow"
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
            >
              {startMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Start Workout
            </Button>
          </div>
        ) : (
          <div className="mt-8">
            <div className="rounded-xl border border-border p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    Exercise {exerciseIndex + 1} / {workout.exercises.length}
                  </p>
                  <h2 className="mt-1 text-2xl">{exercise?.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Plan: {exercise?.sets} × {exercise?.reps}
                  </p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  Set {Math.min(setNumber, totalSets)} / {totalSets}
                </span>
              </div>
              {currentSetComplete ? (
                <div className="mt-6">
                  <div className="grid place-items-center rounded-xl bg-primary/10 p-6">
                    <Check className="size-8 text-primary" />
                    <p className="mt-2 font-semibold">Exercise complete</p>
                  </div>
                  {lastExercise ? (
                    <>
                      <p className="mt-5 text-center text-sm text-muted-foreground">
                        Visi pratimai atlikti. Gali užbaigti treniruotę.
                      </p>
                      <Button
                        size="lg"
                        className="mt-5 w-full rounded-none font-bold hard-shadow"
                        onClick={() => finishMutation.mutate()}
                        disabled={finishMutation.isPending}
                      >
                        {finishMutation.isPending ? (
                          <Loader2 className="mr-2 size-4 animate-spin" />
                        ) : (
                          <Trophy className="mr-2 size-4" />
                        )}
                        Finish Workout
                      </Button>
                    </>
                  ) : (
                    <Button
                      className="mt-5 w-full"
                      onClick={() => {
                        setExerciseIndex((i) => i + 1);
                        setSetNumber(1);
                        setRest(0);
                      }}
                    >
                      Next Exercise
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {exerciseGuidance && (
                    <div className="mt-6 rounded-xl border border-primary/25 bg-primary/5 p-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-primary">
                        Trenerio pasiūlymas
                      </p>
                      <p className="mt-2 text-sm leading-5 text-muted-foreground">
                        {coachMessage(exerciseGuidance)}
                      </p>
                      {exerciseGuidance.suggestedWeightKg !== null && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-3 rounded-full"
                          onClick={() => setWeight(String(exerciseGuidance.suggestedWeightKg))}
                        >
                          Naudoti {exerciseGuidance.suggestedWeightKg} kg
                        </Button>
                      )}
                    </div>
                  )}
                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Reps
                      </label>
                      <Input
                        className="mt-1"
                        inputMode="numeric"
                        min="1"
                        max="100"
                        step="1"
                        value={reps}
                        onChange={(e) => setReps(e.target.value)}
                        placeholder={String(exercise?.reps ?? "")}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Weight kg
                      </label>
                      <Input
                        className="mt-1"
                        inputMode="decimal"
                        min="0"
                        max="1000"
                        step="0.5"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        RPE
                      </label>
                      <Input
                        className="mt-1"
                        inputMode="decimal"
                        min="1"
                        max="10"
                        step="0.5"
                        value={rpe}
                        onChange={(e) => setRpe(e.target.value)}
                        placeholder="1–10"
                      />
                    </div>
                  </div>
                  <Button
                    className="mt-5 w-full rounded-none font-bold"
                    disabled={logMutation.isPending || !reps}
                    onClick={() => logMutation.mutate()}
                  >
                    {logMutation.isPending ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 size-4" />
                    )}
                    Complete Set
                  </Button>
                  {rest > 0 && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-primary">
                      <TimerReset className="size-4" /> Rest: {rest}s
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </GlowCard>
    </main>
  );
}
