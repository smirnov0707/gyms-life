import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Clock,
  Dumbbell,
  Loader2,
  SkipForward,
  TimerReset,
  Trophy,
} from "lucide-react";
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
import type { WorkoutExecutionAdaptation } from "@/lib/workout-execution.schema";
import { errorMessage } from "@/lib/error-message";
import { browserTimeZone } from "@/lib/local-day";

export const Route = createFileRoute("/_authenticated/workout/$day")({ component: WorkoutPage });

function parseOptionalWorkoutNumber(value: string, label: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) throw new Error(label + " turi būti skaičius.");
  return parsed;
}

function formatDuration(seconds: number): string {
  const normalized = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(normalized / 60);
  const remainingSeconds = normalized % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function firstUnloggedSetNumber(totalSets: number, completedSetNumbers: Set<number>): number {
  for (let set = 1; set <= totalSets; set += 1) {
    if (!completedSetNumbers.has(set)) return set;
  }
  return totalSets + 1;
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

function adaptationMessage(adaptation: WorkoutExecutionAdaptation): string | null {
  if (adaptation.reasons.length === 0) return null;
  const parts: string[] = [];
  if (adaptation.reasons.includes("readiness")) parts.push("pakoreguotos serijos pagal savijautą");
  if (adaptation.reasons.includes("high_stress"))
    parts.push("sumažintas krūvis dėl įtemptos dienos");
  if (adaptation.reasons.includes("time_limit") && adaptation.timeBudgetMinutes !== null) {
    parts.push(`sesija sutrumpinta iki maždaug ${adaptation.timeBudgetMinutes} min.`);
  }
  if (adaptation.reasons.includes("travel")) {
    parts.push("kelionėje parinkti pratimai, kuriems pakanka kūno svorio");
  }
  if (adaptation.reasons.includes("equipment_limit")) {
    parts.push("pratimai pritaikyti turimai įrangai");
  }
  if (adaptation.reasons.includes("facility_closed")) {
    parts.push("parinkti pratimai be sporto salės įrangos");
  }
  if (adaptation.omittedExerciseSlugs.length > 0) {
    parts.push(`${adaptation.omittedExerciseSlugs.length} prat. saugiai praleistas`);
  }
  return parts.join(" · ");
}

function WorkoutPage() {
  const { day } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeWorkout, setActiveWorkout] = useState<TrainingPlanDay | null>(null);
  const [workoutAdaptation, setWorkoutAdaptation] = useState<WorkoutExecutionAdaptation | null>(
    null,
  );
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
    queryKey: ["workout", "next"],
    queryFn: () => getTodaysWorkout({ data: { timeZone: browserTimeZone() } }),
  });

  const canonicalWorkout = workoutQuery.data?.status === "READY" ? workoutQuery.data.workout : null;
  const canonicalWorkoutDay = canonicalWorkout?.day ?? null;

  useEffect(() => {
    if (canonicalWorkoutDay === null || day === String(canonicalWorkoutDay)) return;
    navigate({
      to: "/workout/$day",
      params: { day: String(canonicalWorkoutDay) },
      replace: true,
    });
  }, [canonicalWorkoutDay, day, navigate]);

  const startMutation = useMutation({
    mutationFn: async () => {
      if (canonicalWorkoutDay === null) {
        throw new Error("Šiandienai nėra prieinamos treniruotės.");
      }
      await syncQueuedSets();
      return startWorkout({ data: { day: canonicalWorkoutDay, timeZone: browserTimeZone() } });
    },
    onSuccess: (result) => {
      setSessionId(result.session.id);
      setActiveWorkout(result.workout);
      setWorkoutAdaptation(result.adaptation);
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
      const completedSetNumbers = new Set(
        result.logs
          .filter((log) => log.exercise_slug === exercise?.slug && log.done)
          .map((log) => log.set_number),
      );
      setExerciseIndex(Math.max(0, nextIndex));
      setSetNumber(firstUnloggedSetNumber(exercise?.sets ?? 1, completedSetNumbers));
      if (result.resumed) toast.info("Tęsiame nebaigtą treniruotę.");
    },
    onError: (error) => toast.error(errorMessage(error, "Nepavyko pradėti treniruotės")),
  });

  const buildSetInput = (): WorkoutSetSync => {
    if (!sessionId) throw new Error("Workout session is not started.");
    const currentWorkout =
      activeWorkout ?? (workoutQuery.data?.status === "READY" ? workoutQuery.data.workout : null);
    const exercise = currentWorkout?.exercises[exerciseIndex] ?? null;
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
        (
          activeWorkout ??
          (workoutQuery.data?.status === "READY" ? workoutQuery.data.workout : null)
        )?.exercises[exerciseIndex]?.rest_seconds ?? 0,
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
      return finishWorkout({ data: { sessionId, timeZone: browserTimeZone() } });
    },
    onSuccess: async (result) => {
      setFinished(true);
      setSummary({
        duration: result.session.durationSeconds ?? 0,
        volume: result.session.totalVolume,
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["workout"] }),
        qc.invalidateQueries({ queryKey: ["sessions"] }),
        qc.invalidateQueries({ queryKey: ["sessions-all"] }),
        qc.invalidateQueries({ queryKey: ["performance-overview"] }),
        qc.invalidateQueries({ queryKey: ["volume-trend"] }),
        qc.invalidateQueries({ queryKey: ["strength-trend"] }),
        qc.invalidateQueries({ queryKey: ["progress-intelligence"] }),
        qc.invalidateQueries({ queryKey: ["injury-risk"] }),
      ]);
      window.dispatchEvent(new Event("gymslife:adaptation"));
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

  const workout = activeWorkout ?? canonicalWorkout;
  const exercise = workout?.exercises[exerciseIndex];
  const exerciseGuidance = workoutGuidance?.exercises.find(
    (guidance) => guidance.exerciseSlug === exercise?.slug,
  );
  const totalSets = exercise?.sets ?? 0;
  const adaptedDescription = workoutAdaptation ? adaptationMessage(workoutAdaptation) : null;
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
  if (workoutQuery.isError || !workout) {
    const unavailableMessage =
      workoutQuery.data?.status === "WEEKLY_TARGET_REACHED"
        ? "Šios savaitės treniruočių tikslas jau įvykdytas. Šiandien skirk laiko atsistatymui arba grįžk, kai bus kita rekomenduojama sesija."
        : "Šiuo metu nėra prieinamos treniruotės. Atidaryk šiandienos sprendimą, kad pamatytum saugų kitą žingsnį.";
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <GlowCard className="panel p-6">
          <p className={workoutQuery.isError ? "text-destructive" : "text-muted-foreground"}>
            {workoutQuery.isError ? "Treniruotės nepavyko įkelti." : unavailableMessage}
          </p>
          <Button className="mt-4 min-h-11" onClick={() => navigate({ to: "/app" })}>
            Atidaryti šiandienos sprendimą
          </Button>
        </GlowCard>
      </main>
    );
  }
  if (sessionId && !exercise)
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <GlowCard className="panel p-6">
          <p className="text-destructive">Nepavyko atkurti aktyvaus pratimo.</p>
          <Button className="mt-4 min-h-11" onClick={() => navigate({ to: "/app" })}>
            Grįžti į šiandienos sprendimą
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
            Treniruotė užbaigta
          </p>
          <h1 className="mt-2 text-4xl">Puiki treniruotė!</h1>
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-surface-2 p-5">
              <div className="text-3xl font-bold">{formatDuration(summary.duration)}</div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">trukmė</div>
            </div>
            <div className="rounded-xl bg-surface-2 p-5">
              <div className="text-3xl font-bold">{summary.volume} kg</div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                bendras tūris
              </div>
            </div>
          </div>
          <Button
            className="mt-7 min-h-12 w-full font-bold"
            onClick={() => navigate({ to: "/app" })}
          >
            Atidaryti šiandienos sprendimą
          </Button>
        </GlowCard>
      </main>
    );

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 pb-12">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Button variant="ghost" className="min-h-11" onClick={() => navigate({ to: "/app" })}>
          <ArrowLeft className="mr-1 size-4" /> Šiandien
        </Button>
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="size-4" /> {workout.estimated_minutes} min
        </span>
      </div>
      <GlowCard className="panel p-6 md:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">
          Treniruotės sesija
        </p>
        <h1 className="mt-2 text-3xl sm:text-4xl">{workout.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{workout.focus}</p>
        {adaptedDescription ? (
          <p className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
            Šiandienos adaptacija: {adaptedDescription}
          </p>
        ) : null}
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <span>Sesijos progresas</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>
        {!sessionId ? (
          <div className="mt-8 text-center">
            <Dumbbell className="mx-auto size-12 text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">
              {workout.warmup
                ? `Pradžia: ${workout.warmup}`
                : "Pradėsime realią treniruotės sesiją ir išsaugosime kiekvieną atliktą setą."}
            </p>
            <Button
              size="lg"
              className="mt-5 min-h-12 w-full rounded-none font-bold hard-shadow"
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
            >
              {startMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Pradėti arba tęsti treniruotę
            </Button>
          </div>
        ) : (
          <div className="mt-8">
            <div className="rounded-xl border border-border p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    Pratimas {exerciseIndex + 1} / {workout.exercises.length}
                  </p>
                  <h2 className="mt-1 text-2xl">{exercise.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Plane: {exercise.sets} × {exercise.reps}
                  </p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  Setas {Math.min(setNumber, totalSets)} / {totalSets}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Link
                  to="/exercises/$slug"
                  params={{ slug: exercise.slug }}
                  className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  Peržiūrėti techniką
                </Link>
                {exercise.notes ? (
                  <p className="text-sm leading-5 text-muted-foreground">{exercise.notes}</p>
                ) : null}
              </div>
              {currentSetComplete ? (
                <div className="mt-6">
                  <div className="grid place-items-center rounded-xl bg-primary/10 p-6">
                    <Check className="size-8 text-primary" />
                    <p className="mt-2 font-semibold">Pratimas užbaigtas</p>
                  </div>
                  {lastExercise ? (
                    <>
                      <p className="mt-5 text-center text-sm text-muted-foreground">
                        Visi pratimai atlikti. Gali užbaigti treniruotę.
                      </p>
                      {workout.cooldown ? (
                        <p className="mt-3 rounded-xl bg-surface-2 px-4 py-3 text-left text-sm text-muted-foreground">
                          <span className="font-semibold text-foreground">Pabaigai: </span>
                          {workout.cooldown}
                        </p>
                      ) : null}
                      <Button
                        size="lg"
                        className="mt-5 min-h-12 w-full rounded-none font-bold hard-shadow"
                        onClick={() => finishMutation.mutate()}
                        disabled={finishMutation.isPending}
                      >
                        {finishMutation.isPending ? (
                          <Loader2 className="mr-2 size-4 animate-spin" />
                        ) : (
                          <Trophy className="mr-2 size-4" />
                        )}
                        Užbaigti treniruotę
                      </Button>
                    </>
                  ) : (
                    <Button
                      className="mt-5 min-h-12 w-full font-bold"
                      onClick={() => {
                        setExerciseIndex((i) => i + 1);
                        setSetNumber(1);
                        setRest(0);
                      }}
                    >
                      Kitas pratimas
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
                          className="mt-3 min-h-11 rounded-full"
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
                        Pakartojimai
                      </label>
                      <Input
                        className="mt-1 h-11 text-base"
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max="100"
                        step="1"
                        value={reps}
                        onChange={(e) => setReps(e.target.value)}
                        placeholder={String(exercise.reps)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Svoris, kg
                      </label>
                      <Input
                        className="mt-1 h-11 text-base"
                        type="number"
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
                        className="mt-1 h-11 text-base"
                        type="number"
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
                    className="mt-5 min-h-12 w-full rounded-none font-bold"
                    disabled={logMutation.isPending || !reps}
                    onClick={() => logMutation.mutate()}
                  >
                    {logMutation.isPending ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 size-4" />
                    )}
                    Užregistruoti setą
                  </Button>
                  {rest > 0 && (
                    <div
                      className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary"
                      role="status"
                    >
                      <span className="flex items-center gap-2">
                        <TimerReset className="size-4" /> Poilsis: {formatDuration(rest)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-10 px-2 text-primary hover:text-primary"
                        onClick={() => setRest(0)}
                      >
                        <SkipForward className="size-4" /> Praleisti
                      </Button>
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
