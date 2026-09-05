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
import { baseLang, useI18n, type Lang } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/workout/$day")({ component: WorkoutPage });

type Copy = {
  mustBeNumber: (label: string) => string;
  repsLabelPlain: string;
  weightLabelPlain: string;
  rpeLabelPlain: string;
  lastTime: (weightKg: number, reps: string, rpe: string) => string;
  increaseLoad: (weightKg: number) => string;
  recoveryReduction: (weightKg: number) => string;
  missedTarget: (weightKg: number) => string;
  maintainLoad: string;
  logFirst: string;
  adaptation: {
    readiness: string;
    trainingResponse: string;
    highStress: string;
    timeLimit: (minutes: number) => string;
    travel: string;
    equipmentLimit: string;
    facilityClosed: string;
    omitted: (count: number) => string;
  };
  feeling: readonly [string, string, string, string, string];
  syncedOne: string;
  syncedMany: (count: number) => string;
  noWorkoutToday: string;
  resuming: string;
  startFailed: string;
  queuedOffline: string;
  logFailed: string;
  reconnectBeforeFinish: string;
  finished: string;
  finishFailed: string;
  reflectionSaved: string;
  reflectionFailed: string;
  weeklyTargetReached: string;
  noWorkoutAvailable: string;
  loadFailed: string;
  exerciseRestoreFailed: string;
  backToTodaysDecision: string;
  workoutComplete: string;
  totalVolume: string;
  yourSignal: string;
  ratingIsYours: string;
  workoutSaved: string;
  duration: string;
  volume: string;
  feelingLegend: string;
  feelingScaleLabel: string;
  openTodaysDecision: string;
  today: string;
  session: string;
  todaysAdaptation: (description: string) => string;
  sessionProgress: string;
  startHint: (warmup: string | null) => string;
  startOrResume: string;
  exerciseOf: (index: number, total: number) => string;
  planned: (sets: number, reps: string) => string;
  setOf: (current: number, total: number) => string;
  setBeyondPlan: (current: number) => string;
  viewTechnique: string;
  exerciseComplete: string;
  logExtraSet: string;
  beyondPlanNotice: (setNumber: number, planned: number) => string;
  beyondPlanEffect: string;
  cancel: string;
  allExercisesDone: string;
  cooldownPrefix: string;
  finishWorkout: string;
  nextExercise: string;
  coachSuggestion: string;
  useWeight: (weightKg: number) => string;
  reps: string;
  weightKg: string;
  rpeOptional: string;
  decreaseReps: string;
  increaseReps: string;
  decreaseWeight: string;
  increaseWeight: string;
  logSet: string;
  restTimer: string;
  skipRest: string;
};

function copyFor(lang: Lang): Copy {
  if (baseLang(lang) === "en") {
    return {
      mustBeNumber: (label) => `${label} must be a number.`,
      repsLabelPlain: "Reps",
      weightLabelPlain: "Weight",
      rpeLabelPlain: "RPE",
      lastTime: (weightKg, reps, rpe) => `Last time: ${weightKg} kg × ${reps}${rpe}. `,
      increaseLoad: (weightKg) =>
        `Every working set reached the top of the rep range at a controlled RPE. Suggested next load: ${weightKg} kg.`,
      recoveryReduction: (weightKg) =>
        `Today's readiness asks you to protect recovery. Suggested load: ${weightKg} kg; the reduced set count is already applied.`,
      missedTarget: (weightKg) =>
        `Last time the target was missed at a high RPE. Suggested load for technique and reps: ${weightKg} kg.`,
      maintainLoad:
        "Hold this load until you safely reach the top of the rep range on every working set.",
      logFirst: "Log weight, reps and RPE first — then the coach can suggest a concrete next step.",
      adaptation: {
        readiness: "sets adjusted to how you feel",
        trainingResponse: "sets temporarily reduced after repeated hard-session feedback",
        highStress: "load reduced for a demanding day",
        timeLimit: (minutes) => `session shortened to about ${minutes} min`,
        travel: "exercises chosen that need only bodyweight while travelling",
        equipmentLimit: "exercises adapted to the equipment you have",
        facilityClosed: "exercises chosen that need no gym equipment",
        omitted: (count) => `${count} exercise(s) safely skipped`,
      },
      feeling: ["Very hard", "Hard", "Good", "Easy", "Very good"],
      syncedOne: "Saved 1 set recorded earlier while offline.",
      syncedMany: (count) => `Saved ${count} sets recorded earlier while offline.`,
      noWorkoutToday: "No workout is available for today.",
      resuming: "Resuming your unfinished workout.",
      startFailed: "Could not start the workout",
      queuedOffline: "Set saved on this device and will sync when you reconnect.",
      logFailed: "Could not save the set",
      reconnectBeforeFinish: "Reconnect so your sets are saved before finishing the workout.",
      finished: "Workout complete!",
      finishFailed: "Could not finish the workout",
      reflectionSaved: "Your session rating is saved.",
      reflectionFailed: "Could not save the rating",
      weeklyTargetReached:
        "This week's training target is already met. Take today for recovery, or come back when the next session is recommended.",
      noWorkoutAvailable:
        "No workout is available right now. Open today's decision to see a safe next step.",
      loadFailed: "The workout could not be loaded.",
      exerciseRestoreFailed: "The active exercise could not be restored.",
      backToTodaysDecision: "Back to today's decision",
      workoutComplete: "Workout complete",
      totalVolume: "total volume",
      yourSignal: "Your signal",
      ratingIsYours:
        "This is your own rating, not an automatic measurement. A single rating does not change the plan by itself.",
      workoutSaved: "Workout saved",
      duration: "duration",
      volume: "volume",
      feelingLegend: "How did this session feel?",
      feelingScaleLabel: "Session feeling rating from 1 to 5",
      openTodaysDecision: "Open today's decision",
      today: "Today",
      session: "Training session",
      todaysAdaptation: (description) => `Today's adaptation: ${description}`,
      sessionProgress: "Session progress",
      startHint: (warmup) =>
        warmup
          ? `Warm-up: ${warmup}`
          : "We will start a real session and save every set you complete.",
      startOrResume: "Start or resume workout",
      exerciseOf: (index, total) => `Exercise ${index} / ${total}`,
      planned: (sets, reps) => `Planned: ${sets} × ${reps}`,
      setOf: (current, total) => `Set ${current} / ${total}`,
      setBeyondPlan: (current) => `Set ${current} · beyond plan`,
      viewTechnique: "View technique",
      exerciseComplete: "Exercise complete",
      logExtraSet: "Log an extra set",
      beyondPlanNotice: (setNumber, planned) =>
        `Set ${setNumber} goes beyond today's plan (${planned}).`,
      beyondPlanEffect: "It will be recorded as an extra set and counted in your Twin's load.",
      cancel: "Cancel",
      allExercisesDone: "All exercises done. You can finish the workout.",
      cooldownPrefix: "To finish: ",
      finishWorkout: "Finish workout",
      nextExercise: "Next exercise",
      coachSuggestion: "Coach suggestion",
      useWeight: (weightKg) => `Use ${weightKg} kg`,
      reps: "Reps",
      weightKg: "Weight, kg",
      rpeOptional: "RPE (optional)",
      decreaseReps: "Decrease reps",
      increaseReps: "Increase reps",
      decreaseWeight: "Decrease weight",
      increaseWeight: "Increase weight",
      logSet: "Log set",
      restTimer: "Rest",
      skipRest: "Skip",
    };
  }
  return {
    mustBeNumber: (label) => `${label} turi būti skaičius.`,
    repsLabelPlain: "Pakartojimų skaičius",
    weightLabelPlain: "Svoris",
    rpeLabelPlain: "RPE",
    lastTime: (weightKg, reps, rpe) => `Paskutinį kartą: ${weightKg} kg × ${reps}${rpe}. `,
    increaseLoad: (weightKg) =>
      `Visos darbinės serijos pasiekė viršutinę pakartojimų ribą su kontroliuojamu RPE. Siūlomas kitas svoris: ${weightKg} kg.`,
    recoveryReduction: (weightKg) =>
      `Šiandienos pasirengimas prašo tausoti atsistatymą. Siūlomas svoris: ${weightKg} kg; sumažintas serijų skaičius jau pritaikytas.`,
    missedTarget: (weightKg) =>
      `Praeitą kartą tikslas nebuvo pasiektas su aukštu RPE. Siūlomas technikos ir pakartojimų svoris: ${weightKg} kg.`,
    maintainLoad:
      "Laikyk šį svorį, kol saugiai pasieksi viršutinę pakartojimų ribą visose darbinėse serijose.",
    logFirst:
      "Pirmiausia užregistruok svorį, pakartojimus ir RPE — tuomet treneris pasiūlys kitą konkretų žingsnį.",
    adaptation: {
      readiness: "pakoreguotos serijos pagal savijautą",
      trainingResponse:
        "laikinai sumažintos serijos pagal pasikartojantį sunkios treniruotės įvertinimą",
      highStress: "sumažintas krūvis dėl įtemptos dienos",
      timeLimit: (minutes) => `sesija sutrumpinta iki maždaug ${minutes} min.`,
      travel: "kelionėje parinkti pratimai, kuriems pakanka kūno svorio",
      equipmentLimit: "pratimai pritaikyti turimai įrangai",
      facilityClosed: "parinkti pratimai be sporto salės įrangos",
      omitted: (count) => `${count} prat. saugiai praleistas`,
    },
    feeling: ["Labai sunku", "Sunku", "Gerai", "Lengvai", "Labai gerai"],
    syncedOne: "Išsaugota 1 anksčiau neprisijungus įrašyta serija.",
    syncedMany: (count) => `Išsaugotos ${count} anksčiau neprisijungus įrašytos serijos.`,
    noWorkoutToday: "Šiandienai nėra prieinamos treniruotės.",
    resuming: "Tęsiame nebaigtą treniruotę.",
    startFailed: "Nepavyko pradėti treniruotės",
    queuedOffline: "Serija išsaugota šiame įrenginyje ir bus persiųsta atkūrus ryšį.",
    logFailed: "Nepavyko išsaugoti seto",
    reconnectBeforeFinish:
      "Atkurkite ryšį, kad prieš užbaigiant treniruotę būtų išsaugotos serijos.",
    finished: "Treniruotė užbaigta!",
    finishFailed: "Nepavyko užbaigti treniruotės",
    reflectionSaved: "Tavo treniruotės įvertinimas išsaugotas.",
    reflectionFailed: "Nepavyko išsaugoti įvertinimo",
    weeklyTargetReached:
      "Šios savaitės treniruočių tikslas jau įvykdytas. Šiandien skirk laiko atsistatymui arba grįžk, kai bus kita rekomenduojama sesija.",
    noWorkoutAvailable:
      "Šiuo metu nėra prieinamos treniruotės. Atidaryk šiandienos sprendimą, kad pamatytum saugų kitą žingsnį.",
    loadFailed: "Treniruotės nepavyko įkelti.",
    exerciseRestoreFailed: "Nepavyko atkurti aktyvaus pratimo.",
    backToTodaysDecision: "Grįžti į šiandienos sprendimą",
    workoutComplete: "Treniruotė užbaigta",
    totalVolume: "bendras tūris",
    yourSignal: "Tavo signalas",
    ratingIsYours:
      "Tai tavo nurodytas įvertinimas, ne automatinis rodiklis. Vienas įvertinimas savaime nekeičia plano.",
    workoutSaved: "Treniruotė išsaugota",
    duration: "trukmė",
    volume: "tūris",
    feelingLegend: "Kaip jautėsi ši treniruotė?",
    feelingScaleLabel: "Treniruotės savijautos įvertinimas nuo 1 iki 5",
    openTodaysDecision: "Atidaryti šiandienos sprendimą",
    today: "Šiandien",
    session: "Treniruotės sesija",
    todaysAdaptation: (description) => `Šiandienos adaptacija: ${description}`,
    sessionProgress: "Sesijos progresas",
    startHint: (warmup) =>
      warmup
        ? `Pradžia: ${warmup}`
        : "Pradėsime realią treniruotės sesiją ir išsaugosime kiekvieną atliktą setą.",
    startOrResume: "Pradėti arba tęsti treniruotę",
    exerciseOf: (index, total) => `Pratimas ${index} / ${total}`,
    planned: (sets, reps) => `Plane: ${sets} × ${reps}`,
    setOf: (current, total) => `Setas ${current} / ${total}`,
    setBeyondPlan: (current) => `Setas ${current} · virš plano`,
    viewTechnique: "Peržiūrėti techniką",
    exerciseComplete: "Pratimas užbaigtas",
    logExtraSet: "Registruoti papildomą setą",
    beyondPlanNotice: (setNumber, planned) =>
      `Setas ${setNumber} viršija šiandienos planą (${planned}).`,
    beyondPlanEffect: "Jis bus užrašytas kaip papildomas ir įskaičiuotas į tavo dvynio krūvį.",
    cancel: "Atšaukti",
    allExercisesDone: "Visi pratimai atlikti. Gali užbaigti treniruotę.",
    cooldownPrefix: "Pabaigai: ",
    finishWorkout: "Užbaigti treniruotę",
    nextExercise: "Kitas pratimas",
    coachSuggestion: "Trenerio pasiūlymas",
    useWeight: (weightKg) => `Naudoti ${weightKg} kg`,
    reps: "Pakartojimai",
    weightKg: "Svoris, kg",
    rpeOptional: "RPE (nebūtina)",
    decreaseReps: "Sumažinti pakartojimus",
    increaseReps: "Padidinti pakartojimus",
    decreaseWeight: "Sumažinti svorį",
    increaseWeight: "Padidinti svorį",
    logSet: "Registruoti setą",
    restTimer: "Poilsis",
    skipRest: "Praleisti",
  };
}

function parseOptionalWorkoutNumber(value: string, label: string, copy: Copy): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) throw new Error(copy.mustBeNumber(label));
  return parsed;
}

function formatDuration(seconds: number): string {
  const normalized = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(normalized / 60);
  const remainingSeconds = normalized % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function coachMessage(guidance: ExerciseTrainingGuidance, copy: Copy): string {
  const previous = guidance.previous
    ? copy.lastTime(
        guidance.previous.weightKg,
        String(guidance.previous.reps ?? "—"),
        guidance.previous.rpe !== null ? `, ${copy.rpeLabelPlain} ${guidance.previous.rpe}` : "",
      )
    : "";

  if (guidance.action === "INCREASE_LOAD") {
    return previous + copy.increaseLoad(guidance.suggestedWeightKg ?? 0);
  }
  if (guidance.reason === "RECOVERY_REDUCTION") {
    return previous + copy.recoveryReduction(guidance.suggestedWeightKg ?? 0);
  }
  if (guidance.reason === "HIGH_EFFORT_MISSED_TARGET") {
    return previous + copy.missedTarget(guidance.suggestedWeightKg ?? 0);
  }
  if (guidance.action === "MAINTAIN_LOAD") {
    return previous + copy.maintainLoad;
  }
  return copy.logFirst;
}

function adaptationMessage(adaptation: WorkoutExecutionAdaptation, copy: Copy): string | null {
  if (adaptation.reasons.length === 0) return null;
  const parts: string[] = [];
  if (adaptation.reasons.includes("readiness")) parts.push(copy.adaptation.readiness);
  if (adaptation.reasons.includes("training_response")) {
    parts.push(copy.adaptation.trainingResponse);
  }
  if (adaptation.reasons.includes("high_stress")) parts.push(copy.adaptation.highStress);
  if (adaptation.reasons.includes("time_limit") && adaptation.timeBudgetMinutes !== null) {
    parts.push(copy.adaptation.timeLimit(adaptation.timeBudgetMinutes));
  }
  if (adaptation.reasons.includes("travel")) parts.push(copy.adaptation.travel);
  if (adaptation.reasons.includes("equipment_limit")) parts.push(copy.adaptation.equipmentLimit);
  if (adaptation.reasons.includes("facility_closed")) parts.push(copy.adaptation.facilityClosed);
  if (adaptation.omittedExerciseSlugs.length > 0) {
    parts.push(copy.adaptation.omitted(adaptation.omittedExerciseSlugs.length));
  }
  return parts.join(" · ");
}

function workoutFeelingOptionsFor(copy: Copy) {
  return copy.feeling.map((label, index) => ({ value: index + 1, label }));
}

function WorkoutPage() {
  const { day } = Route.useParams();
  const { lang } = useI18n();
  // Memoised so `copy` is a stable dependency: rebuilt every render it would
  // change the identity of the callbacks below, and the effect that flushes
  // queued sets would re-run on every render.
  const copy = useMemo(() => copyFor(lang), [lang]);
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
      toast.success(result.synced === 1 ? copy.syncedOne : copy.syncedMany(result.synced));
    }
    return result;
  }, [copy]);

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
        throw new Error(copy.noWorkoutToday);
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
      if (result.resumed) toast.info(copy.resuming);
    },
    onError: (error) => toast.error(errorMessage(error, copy.startFailed)),
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
      reps: parseOptionalWorkoutNumber(reps, copy.repsLabelPlain, copy),
      weightKg: parseOptionalWorkoutNumber(weight, copy.weightLabelPlain, copy),
      rpe: parseOptionalWorkoutNumber(rpe, copy.rpeLabelPlain, copy),
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
        toast.info(copy.queuedOffline);
      }
    },
    onError: (error) => toast.error(errorMessage(error, copy.logFailed)),
  });

  const finishMutation = useMutation({
    mutationFn: async () => {
      if (!sessionId) throw new Error("Workout session is not started.");
      if (hasQueuedWorkoutSets(sessionId)) {
        await syncQueuedSets();
        if (hasQueuedWorkoutSets(sessionId)) {
          throw new Error(copy.reconnectBeforeFinish);
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
      toast.success(copy.finished);
    },
    onError: (error) => toast.error(errorMessage(error, copy.finishFailed)),
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
      toast.success(copy.reflectionSaved);
    },
    onError: (error) => toast.error(errorMessage(error, copy.reflectionFailed)),
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

  const adaptedDescription = workoutAdaptation ? adaptationMessage(workoutAdaptation, copy) : null;
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
        ? copy.weeklyTargetReached
        : copy.noWorkoutAvailable;
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <GlowCard className="panel p-6">
          <p className={workoutQuery.isError ? "text-destructive" : "text-muted-foreground"}>
            {workoutQuery.isError ? copy.loadFailed : unavailableMessage}
          </p>
          <Button className="mt-4 min-h-11" onClick={() => navigate({ to: "/app" })}>
            {copy.openTodaysDecision}
          </Button>
        </GlowCard>
      </main>
    );
  }
  if (!exercise)
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <GlowCard className="panel p-6">
          <p className="text-destructive">{copy.exerciseRestoreFailed}</p>
          <Button className="mt-4 min-h-11" onClick={() => navigate({ to: "/app" })}>
            {copy.backToTodaysDecision}
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
            {copy.workoutComplete}
          </p>
          <h1 className="mt-2 text-4xl">{copy.workoutSaved}</h1>
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-surface-2 p-5">
              <div className="text-3xl font-bold">{formatDuration(summary.duration)}</div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                {copy.duration}
              </div>
            </div>
            <div className="rounded-xl bg-surface-2 p-5">
              <div className="text-3xl font-bold">{summary.volume} kg</div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                {copy.totalVolume}
              </div>
            </div>
          </div>
          {replay.length > 0 && <BodyReplay contributions={replay} />}
          <section
            className="mt-6 rounded-2xl border border-border bg-surface-2 p-5 text-left"
            aria-labelledby="workout-reflection-title"
          >
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              {copy.yourSignal}
            </p>
            <h2 id="workout-reflection-title" className="mt-2 text-xl">
              {copy.feelingLegend}
            </h2>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">{copy.ratingIsYours}</p>
            <div
              className="mt-4 grid grid-cols-5 gap-2"
              role="radiogroup"
              aria-label={copy.feelingScaleLabel}
            >
              {workoutFeelingOptionsFor(copy).map((option) => {
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
                ? `1 — ${copy.feeling[0]} · 5 — ${copy.feeling[4]}`
                : `${workoutFeeling} — ${copy.feeling[workoutFeeling - 1] ?? ""}`}
            </p>
          </section>
          <Button
            className="mt-7 min-h-12 w-full font-bold"
            onClick={() => navigate({ to: "/app" })}
          >
            {copy.openTodaysDecision}
          </Button>
        </GlowCard>
      </main>
    );

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 pb-12">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Button variant="ghost" className="min-h-11" onClick={() => navigate({ to: "/app" })}>
          <ArrowLeft className="mr-1 size-4" /> {copy.today}
        </Button>
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="size-4" /> {workout.estimated_minutes} min
        </span>
      </div>
      <GlowCard className="panel p-6 md:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">{copy.session}</p>
        <h1 className="mt-2 text-3xl sm:text-4xl">{workout.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{workout.focus}</p>
        {adaptedDescription ? (
          <p className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
            {copy.todaysAdaptation(adaptedDescription)}
          </p>
        ) : null}
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <span>{copy.sessionProgress}</span>
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
              {copy.startHint(workout.warmup ?? null)}
            </p>
            <Button
              size="lg"
              className="mt-5 min-h-12 w-full rounded-none font-bold hard-shadow"
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
            >
              {startMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {copy.startOrResume}
            </Button>
          </div>
        ) : (
          <div className="mt-8">
            <div className="rounded-xl border border-border p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    {copy.exerciseOf(exerciseIndex + 1, workout.exercises.length)}
                  </p>
                  <h2 className="mt-1 text-2xl">{exercise.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {copy.planned(exercise.sets, String(exercise.reps))}
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
                    ? copy.setBeyondPlan(setNumber)
                    : copy.setOf(Math.min(setNumber, totalSets), totalSets)}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Link
                  to="/exercises/$slug"
                  params={{ slug: exercise.slug }}
                  className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  {copy.viewTechnique}
                </Link>
                {exercise.notes ? (
                  <p className="text-sm leading-5 text-muted-foreground">{exercise.notes}</p>
                ) : null}
              </div>
              {currentSetComplete ? (
                <div className="mt-6">
                  <div className="grid place-items-center rounded-xl bg-primary/10 p-6">
                    <Check className="size-8 text-primary" />
                    <p className="mt-2 font-semibold">{copy.exerciseComplete}</p>
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
                    {copy.logExtraSet}
                  </Button>
                  {lastExercise ? (
                    <>
                      <p className="mt-5 text-center text-sm text-muted-foreground">
                        {copy.allExercisesDone}
                      </p>
                      {workout.cooldown ? (
                        <p className="mt-3 rounded-xl bg-surface-2 px-4 py-3 text-left text-sm text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {copy.cooldownPrefix}
                          </span>
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
                        {copy.finishWorkout}
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
                      {copy.nextExercise}
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {plannedSetsDone && (
                    <p className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm leading-5 text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {copy.beyondPlanNotice(setNumber, totalSets)}
                      </span>{" "}
                      {copy.beyondPlanEffect}{" "}
                      <button
                        type="button"
                        className="font-semibold text-primary underline underline-offset-2"
                        onClick={() => setLoggingExtra(false)}
                      >
                        {copy.cancel}
                      </button>
                    </p>
                  )}
                  {exerciseGuidance && (
                    <div className="mt-6 rounded-xl border border-primary/25 bg-primary/5 p-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-primary">
                        {copy.coachSuggestion}
                      </p>
                      <p className="mt-2 text-sm leading-5 text-muted-foreground">
                        {coachMessage(exerciseGuidance, copy)}
                      </p>
                      {exerciseGuidance.suggestedWeightKg !== null && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-3 min-h-11 rounded-full"
                          onClick={() => setWeight(String(exerciseGuidance.suggestedWeightKg))}
                        >
                          {copy.useWeight(exerciseGuidance.suggestedWeightKg)}
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
                        {copy.reps}
                      </label>
                      {/* Steppers so adjusting a set never opens the keyboard. */}
                      <div className="mt-1 flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label={copy.decreaseReps}
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
                          aria-label={copy.increaseReps}
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
                        {copy.weightKg}
                      </label>
                      <div className="mt-1 flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label={copy.decreaseWeight}
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
                          aria-label={copy.increaseWeight}
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
                    {copy.logSet}
                  </Button>
                  {rest > 0 && (
                    <div
                      className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary"
                      role="status"
                    >
                      <span className="flex items-center gap-2">
                        <TimerReset className="size-4" /> {copy.restTimer}: {formatDuration(rest)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-10 px-2 text-primary hover:text-primary"
                        onClick={() => setRest(0)}
                      >
                        <SkipForward className="size-4" /> {copy.skipRest}
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
