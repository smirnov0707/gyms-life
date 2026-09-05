import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Clock,
  Dumbbell,
  Loader2,
  Minus,
  Plus,
  SkipForward,
  TimerReset,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BodyReplay } from "@/components/twin/BodyReplay";
import type { SessionMuscleContribution } from "@/lib/session-muscle-breakdown";
import {
  REPS_STEP,
  WEIGHT_STEP_KG,
  nextSetNumber,
  plannedRepsPrefill,
  stepValue,
  suggestedWeightPrefill,
} from "@/lib/workout-set-prefill";
import { GlowCard } from "@/components/GlowCard";
import { getTodaysWorkout } from "@/lib/todays-workout.functions";
import { startWorkout } from "@/lib/start-workout.functions";
import { logWorkoutSet } from "@/lib/set-log.functions";
import { finishWorkout } from "@/lib/finish-workout.functions";
import { recordWorkoutReflection } from "@/lib/workout-reflection.functions";
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
  if (adaptation.reasons.includes("training_response")) {
    parts.push("laikinai sumažintos serijos pagal pasikartojantį sunkios treniruotės įvertinimą");
  }
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

const workoutFeelingOptions = [
  { value: 1, label: "Labai sunku" },
  { value: 2, label: "Sunku" },
  { value: 3, label: "Gerai" },
  { value: 4, label: "Lengvai" },
  { value: 5, label: "Labai gerai" },
] as const;

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
  // The athlete has chosen to keep working past what the day prescribed. The
  // plan is a recommendation; the extra set already happened, so it is written
  // down rather than argued with.
  const [loggingExtra, setLoggingExtra] = useState(false);
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");
  const [rpe, setRpe] = useState("");
  const [rest, setRest] = useState(0);
  const [finished, setFinished] = useState(false);
  const [summary, setSummary] = useState<{ duration: number; volume: number } | null>(null);
  const [replay, setReplay] = useState<SessionMuscleContribution[]>([]);
  const [workoutFeeling, setWorkoutFeeling] = useState<number | null>(null);

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
      setSetNumber(nextSetNumber(exercise?.sets ?? 1, completedSetNumbers));
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
      // Stamped here, not on the server: offline this payload may not be
      // delivered for hours, and the dvynys decays fatigue from this instant.
      performedAt: new Date().toISOString(),
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
      // Reps and weight carry into the next set: the set after this one is
      // almost always the same, and clearing them made every set of an
      // exercise cost the same two keyboard entries as the first.
      //
      // RPE never carries. It is a fresh subjective judgement each set, and
      // a stale one re-submitted would be a USER_REPORTED value the person
      // never actually reported.
      setRpe("");
      setRest(
        (
          activeWorkout ??
          (workoutQuery.data?.status === "READY" ? workoutQuery.data.workout : null)
        )?.exercises[exerciseIndex]?.rest_seconds ?? 0,
      );
      setSetNumber((n) => n + 1);
      // Back to the finished-exercise panel after each extra set, so moving
      // on stays one tap away rather than leaving the form as the only
      // thing on screen with no route to the next exercise.
      setLoggingExtra(false);
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
      setReplay(result.muscleBreakdown);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["workout"] }),
        qc.invalidateQueries({ queryKey: ["sessions"] }),
        qc.invalidateQueries({ queryKey: ["sessions-all"] }),
        qc.invalidateQueries({ queryKey: ["performance-overview"] }),
        qc.invalidateQueries({ queryKey: ["volume-trend"] }),
        qc.invalidateQueries({ queryKey: ["strength-trend"] }),
        qc.invalidateQueries({ queryKey: ["injury-risk"] }),
      ]);
      window.dispatchEvent(new Event("gymslife:adaptation"));
      toast.success("Treniruotė užbaigta!");
    },
    onError: (error) => toast.error(errorMessage(error, "Nepavyko užbaigti treniruotės")),
  });

  const reflectionMutation = useMutation({
    mutationFn: async (feeling: number) => {
      if (!sessionId) throw new Error("Workout session is not started.");
      return recordWorkoutReflection({ data: { sessionId, feeling } });
    },
    onSuccess: (reflection) => {
      setWorkoutFeeling(reflection.feeling);
      // Today recomputes its canonical athlete snapshot from this new,
      // user-reported signal. The decision engine still applies its own
      // evidence and safety thresholds before adapting a future workout.
      window.dispatchEvent(new Event("gymslife:adaptation"));
      toast.success("Tavo treniruotės įvertinimas išsaugotas.");
    },
    onError: (error) => toast.error(errorMessage(error, "Nepavyko išsaugoti įvertinimo")),
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
  const suggestedWeight = suggestedWeightPrefill(exerciseGuidance?.suggestedWeightKg);

  // Pre-fill once per exercise, from what the plan and the person's own
  // history already state. Recording the set that was planned should cost a
  // single tap; it used to cost two keyboard entries even when nothing had
  // changed from the plan.
  const prefilledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!exercise) return;
    const key = `${exercise.slug}:${suggestedWeight}`;
    if (prefilledFor.current === key) return;
    prefilledFor.current = key;
    setReps(plannedRepsPrefill(exercise.reps));
    setWeight(suggestedWeight);
  }, [exercise, suggestedWeight]);

  const adaptedDescription = workoutAdaptation ? adaptationMessage(workoutAdaptation) : null;
  const plannedSetsDone = setNumber > totalSets;
  const currentSetComplete = plannedSetsDone && !loggingExtra;
  const lastExercise = Boolean(workout && exerciseIndex === workout.exercises.length - 1);
  const progress = useMemo(
    () =>
      workout
        ? Math.round(
            ((exerciseIndex +
              // Extra sets are real work but not extra progress through the
              // plan; an exercise is at most one exercise done.
              Math.min(1, plannedSetsDone ? 1 : (setNumber - 1) / Math.max(1, totalSets))) /
              workout.exercises.length) *
              100,
          )
        : 0,
    [workout, exerciseIndex, plannedSetsDone, setNumber, totalSets],
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
  if (!exercise)
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
          <h1 className="mt-2 text-4xl">Treniruotė išsaugota</h1>
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
          {replay.length > 0 && <BodyReplay contributions={replay} />}
          <section
            className="mt-6 rounded-2xl border border-border bg-surface-2 p-5 text-left"
            aria-labelledby="workout-reflection-title"
          >
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              Tavo signalas
            </p>
            <h2 id="workout-reflection-title" className="mt-2 text-xl">
              Kaip jautėsi ši treniruotė?
            </h2>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">
              Tai tavo nurodytas įvertinimas, ne automatinis rodiklis. Vienas įvertinimas savaime
              nekeičia plano.
            </p>
            <div
              className="mt-4 grid grid-cols-5 gap-2"
              role="radiogroup"
              aria-label="Treniruotės savijautos įvertinimas nuo 1 iki 5"
            >
              {workoutFeelingOptions.map((option) => {
                const selected = workoutFeeling === option.value;
                const isSaving =
                  reflectionMutation.isPending && reflectionMutation.variables === option.value;
                return (
                  <Button
                    key={option.value}
                    type="button"
                    variant={selected ? "default" : "outline"}
                    className="min-h-12 px-2 text-base font-bold"
                    aria-label={`${option.value}: ${option.label}`}
                    aria-checked={selected}
                    role="radio"
                    disabled={reflectionMutation.isPending}
                    onClick={() => reflectionMutation.mutate(option.value)}
                  >
                    {isSaving ? <Loader2 className="size-4 animate-spin" /> : option.value}
                  </Button>
                );
              })}
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {workoutFeeling === null
                ? "1 — labai sunku · 5 — labai gerai"
                : `${workoutFeeling} — ${workoutFeelingOptions[workoutFeeling - 1]?.label ?? ""}`}
            </p>
          </section>
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
                {/* Past the plan the counter reports the real set number
                    rather than pinning to the planned total, which would have
                    read "3 / 3" while the fourth set was being logged. */}
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    plannedSetsDone && loggingExtra
                      ? "bg-amber-500/15 text-amber-500"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {plannedSetsDone && loggingExtra
                    ? `Setas ${setNumber} · virš plano`
                    : `Setas ${Math.min(setNumber, totalSets)} / ${totalSets}`}
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
                  {/* Doing more than the plan asked is normal. Without this the
                      extra work simply could not be recorded, and the dvynys
                      would model a body that trained less than it did. */}
                  <Button
                    variant="outline"
                    className="mt-4 min-h-12 w-full rounded-xl font-semibold"
                    onClick={() => setLoggingExtra(true)}
                  >
                    <Plus className="mr-2 size-4" />
                    Registruoti papildomą setą
                  </Button>
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
                        setLoggingExtra(false);
                        setRest(0);
                      }}
                    >
                      Kitas pratimas
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {plannedSetsDone && (
                    <p className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm leading-5 text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        Setas {setNumber} viršija šiandienos planą ({totalSets}).
                      </span>{" "}
                      Jis bus užrašytas kaip papildomas ir įskaičiuotas į tavo dvynio krūvį.{" "}
                      <button
                        type="button"
                        className="font-semibold text-primary underline underline-offset-2"
                        onClick={() => setLoggingExtra(false)}
                      >
                        Atšaukti
                      </button>
                    </p>
                  )}
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
                      <label
                        className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
                        htmlFor="set-reps"
                      >
                        Pakartojimai
                      </label>
                      {/* Steppers so adjusting a set never opens the keyboard. */}
                      <div className="mt-1 flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label="Sumažinti pakartojimus"
                          className="size-11 shrink-0 rounded-xl"
                          onClick={() =>
                            setReps((v) =>
                              stepValue(v, -REPS_STEP, { min: 1, max: 100, fallback: 9 }),
                            )
                          }
                        >
                          <Minus className="size-4" />
                        </Button>
                        <Input
                          id="set-reps"
                          className="h-11 text-center text-base"
                          type="number"
                          inputMode="numeric"
                          min="1"
                          max="100"
                          step="1"
                          value={reps}
                          onChange={(e) => setReps(e.target.value)}
                          placeholder={String(exercise.reps)}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label="Padidinti pakartojimus"
                          className="size-11 shrink-0 rounded-xl"
                          onClick={() =>
                            setReps((v) =>
                              stepValue(v, REPS_STEP, { min: 1, max: 100, fallback: 7 }),
                            )
                          }
                        >
                          <Plus className="size-4" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <label
                        className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
                        htmlFor="set-weight"
                      >
                        Svoris, kg
                      </label>
                      <div className="mt-1 flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label="Sumažinti svorį"
                          className="size-11 shrink-0 rounded-xl"
                          onClick={() =>
                            setWeight((v) =>
                              stepValue(v, -WEIGHT_STEP_KG, { min: 0, max: 1000, fallback: 2.5 }),
                            )
                          }
                        >
                          <Minus className="size-4" />
                        </Button>
                        <Input
                          id="set-weight"
                          className="h-11 text-center text-base"
                          type="number"
                          inputMode="decimal"
                          min="0"
                          max="1000"
                          step="0.5"
                          value={weight}
                          onChange={(e) => setWeight(e.target.value)}
                          placeholder="0"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label="Padidinti svorį"
                          className="size-11 shrink-0 rounded-xl"
                          onClick={() =>
                            setWeight((v) =>
                              stepValue(v, WEIGHT_STEP_KG, { min: 0, max: 1000, fallback: 0 }),
                            )
                          }
                        >
                          <Plus className="size-4" />
                        </Button>
                      </div>
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
