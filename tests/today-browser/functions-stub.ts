import { z } from "zod";

/**
 * Stands in for every `*.functions` module the Today tree imports.
 *
 * The default is "the source answered, and it had nothing", because that is
 * this account's real database: no health samples, no nutrition rows, one
 * logged set. `?signals=fail` makes the signal read throw instead, so the
 * screen can be checked in the state where nobody could look — a case that
 * renders identically to "no data" unless the component keeps them apart.
 *
 * Test-only. Never bundled into the app.
 */
const mode = () => new URLSearchParams(window.location.search).get("signals") ?? "empty";

const LIVE_SIGNAL_IDS = [
  "sleep",
  "hrv",
  "restingHr",
  "steps",
  "activeKcal",
  "weight",
  "bodyFat",
] as const;

export const getLiveSignals = async () => {
  if (mode() === "fail") throw new Error("live signals unavailable");
  // `?signals=measured` gives resting HR three readings and sleep exactly one,
  // which is the pair the sparkline has to treat differently.
  if (mode() === "measured") {
    return LIVE_SIGNAL_IDS.map((id) => {
      if (id === "restingHr") {
        return {
          id,
          state: "measured" as const,
          value: 52,
          recordedOn: "2026-09-07",
          ageDays: 0,
          delta: -3,
          source: "apple_health",
          history: [
            { day: "2026-09-01", value: 58 },
            { day: "2026-09-05", value: 55 },
            { day: "2026-09-07", value: 52 },
          ],
        };
      }
      if (id === "sleep") {
        return {
          id,
          state: "measured" as const,
          value: 7.4,
          recordedOn: "2026-09-07",
          ageDays: 0,
          delta: null,
          source: "apple_health",
          history: [{ day: "2026-09-07", value: 7.4 }],
        };
      }
      return {
        id,
        state: "absent" as const,
        value: null,
        recordedOn: null,
        ageDays: null,
        delta: null,
        source: null,
        history: [],
      };
    });
  }
  return LIVE_SIGNAL_IDS.map((id) => ({
    id,
    state: "absent" as const,
    value: null,
    recordedOn: null,
    ageDays: null,
    delta: null,
    source: null,
    history: [],
  }));
};

/** `?twin=regions` gives the snapshot three regions: two calculated and one
 *  with no evidence at all, which is the pair the region list has to keep
 *  apart. The default stays empty, because that is this account's state. */
export const getTwinSnapshot = async () => ({
  calculationVersion: "TEST-FIXTURE-NOT-USER-DATA",
  bodyVariant: "male" as const,
  computedAt: "2026-09-07T06:00:00.000Z",
  evidenceWindowDays: 14,
  dataAvailable: true,
  regions:
    new URLSearchParams(window.location.search).get("twin") === "regions"
      ? [
          {
            region: "chest",
            provenance: "calculated" as const,
            recoveryPct: 41,
            recoveryBand: "fatigued" as const,
            volumeKg: 4200,
            lastTrainedHoursAgo: 18,
          },
          {
            region: "back",
            provenance: "calculated" as const,
            recoveryPct: 55,
            recoveryBand: "moderate" as const,
            volumeKg: 5100,
            lastTrainedHoursAgo: 96,
          },
          {
            region: "calves",
            provenance: "unknown" as const,
            recoveryPct: null,
            recoveryBand: "unknown" as const,
            volumeKg: null,
            lastTrainedHoursAgo: null,
          },
        ]
      : [],
});

/** A key shaped like the real ones, so masking can be checked against it. */
export const PREVIEW_HEALTH_TOKEN = "11111111-2222-4333-8444-555555555555";
export const getHealthSource = async () => ({
  status: "ready" as const,
  token: PREVIEW_HEALTH_TOKEN,
  lastSample: null,
});
export const rotateHealthToken = async () => ({
  status: "ready" as const,
  token: PREVIEW_HEALTH_TOKEN,
});

/** `?body=single|change` drives the composition card; the default is this
 *  account's state, which is one measurement and therefore no direction. */
export const getBodyComposition = async () => {
  const mode = new URLSearchParams(window.location.search).get("body") ?? "single";
  // `?source=scan|scale` picks the provenance; the default is a row written
  // before provenance was recorded, which must not read as measured.
  const provenance = new URLSearchParams(window.location.search).get("source");
  const origin = {
    estimated: provenance === "scan",
    provenanceUnknown: provenance !== "scan" && provenance !== "scale",
  };
  const latest = {
    day: "2026-09-02",
    weightKg: 85,
    bodyFatPercent: 20,
    fatMassKg: 17,
    leanMassKg: 68,
    ...origin,
  };
  if (mode === "none") return { status: "none" as const };
  if (mode === "change") {
    return {
      status: "change" as const,
      latest,
      earliest: {
        day: "2026-08-13",
        weightKg: 86.5,
        bodyFatPercent: 22,
        fatMassKg: 19,
        leanMassKg: 67.5,
        ...origin,
      },
      days: 20,
      weightKg: -1.5,
      fatMassKg: -2,
      leanMassKg: 0.5,
    };
  }
  return { status: "single" as const, latest };
};

export const getLabOverview = async () => null;
export const getTwinTrendHistory = async () => null;
/** `?plan=ready` puts a real session in front of the panel; the default is the
 *  account's actual state, which is no active programme. */
export const getTodaysWorkout = async () => {
  if (new URLSearchParams(window.location.search).get("plan") !== "ready") {
    return { status: "NO_ACTIVE_PLAN" as const };
  }
  return {
    status: "READY" as const,
    plan: { id: "fixture", daysPerWeek: 4 },
    workout: {
      day: 2,
      title: "Upper body focus",
      focus: "upper",
      warmup: "",
      cooldown: "",
      estimated_minutes: 49,
      exercises: [
        {
          slug: "bench-press",
          name: "Bench press",
          sets: 4,
          reps: "6",
          rest_seconds: 150,
          notes: "",
        },
        { slug: "pull-up", name: "Pull up", sets: 4, reps: "8", rest_seconds: 120, notes: "" },
        {
          slug: "incline-db-press",
          name: "Incline dumbbell press",
          sets: 3,
          reps: "10",
          rest_seconds: 90,
          notes: "",
        },
        {
          slug: "chest-supported-row",
          name: "Chest supported row",
          sets: 3,
          reps: "10",
          rest_seconds: 90,
          notes: "",
        },
        {
          slug: "lateral-raise",
          name: "Lateral raise",
          sets: 3,
          reps: "12",
          rest_seconds: 60,
          notes: "",
        },
      ],
    },
  };
};
export const getTodayDecision = async () => null;
export const recordTodayDecisionOutcome = async () => null;
export const getActiveLifeContexts = async () => [];
export const setActiveLifeContext = async () => null;
export const dismissActiveLifeContext = async () => null;
export const getDailyBrief = async () => null;
export const forecastProgress = async () => null;

export const BRIEF = { version: 1 };
/** Loose on purpose: the fixture never feeds it a cached brief. */
export const DailyBriefSchema = z.unknown();

/** `?sync=fail` makes delivery fail, which is the state the offline strip
 *  exists for: sets that happened and that nothing on the server knows. */
export const logWorkoutSet = async () => {
  if (new URLSearchParams(window.location.search).get("sync") === "fail") {
    throw new Error("network unavailable");
  }
  return { ok: true };
};

/** `?targets=rest|fail` drives the Twin home's session panel; the default is
 *  a real session, so the body has something to carry. */
export const getTodaysTargets = async () => {
  const mode = new URLSearchParams(window.location.search).get("targets");
  if (mode === "fail") throw new Error("programme unavailable");
  if (mode === "rest") return { status: "rest" as const };
  return {
    status: "session" as const,
    title: "Upper body focus",
    // Chest is on today's list and fatigued; back is fatigued and not on it.
    // One colour could not say both, which is why the session is marked
    // beside the body rather than painted on to it.
    regions: ["chest"],
    byRegion: {
      chest: [
        { slug: "bench-press", name: "Bench press", sets: 4, reps: "6" },
        { slug: "incline-db-press", name: "Incline dumbbell press", sets: 3, reps: "10" },
      ],
    },
    unplaceable: [{ slug: "sled-push", name: "Sled push", sets: 3, reps: "20 m" }],
  };
};

/** `?load=first|none|fail` covers the three states the load panel must keep
 *  apart: a week to compare against, a first week, and an unread source. */
export const getTrainingLoad = async () => {
  const mode = new URLSearchParams(window.location.search).get("load");
  if (mode === "fail") throw new Error("sets unavailable");
  const days = [
    { day: "2026-09-01", volumeKg: 0 },
    { day: "2026-09-02", volumeKg: 3200 },
    { day: "2026-09-03", volumeKg: 0 },
    { day: "2026-09-04", volumeKg: 4100 },
    { day: "2026-09-05", volumeKg: 0 },
    { day: "2026-09-06", volumeKg: 5180 },
    { day: "2026-09-07", volumeKg: 2100 },
  ];
  if (mode === "none") {
    return {
      status: "counted" as const,
      days: days.map((day) => ({ ...day, volumeKg: 0 })),
      thisWeekKg: 0,
      lastWeekKg: 0,
      changeFraction: null,
      countedSets: 0,
      uncountedSets: 4,
    };
  }
  if (mode === "first") {
    return {
      status: "counted" as const,
      days,
      thisWeekKg: 14580,
      lastWeekKg: 0,
      changeFraction: null,
      countedSets: 42,
      uncountedSets: 0,
    };
  }
  return {
    status: "counted" as const,
    days,
    thisWeekKg: 14580,
    lastWeekKg: 12400,
    changeFraction: 0.1758,
    countedSets: 42,
    uncountedSets: 3,
  };
};

/** `?effect=partial|none|nobreakdown` covers the states the effect card must
 *  keep apart: complete shares, nothing finished, and a session whose split
 *  could not be computed. */
export const getLastSessionEffect = async () => {
  const mode = new URLSearchParams(window.location.search).get("effect");
  if (mode === "fail") throw new Error("sessions unavailable");
  if (mode === "none") return { status: "none" as const };
  const base = {
    status: "session" as const,
    title: "Upper body focus",
    finishedAt: "2026-09-06T18:40:00.000Z",
  };
  if (mode === "nobreakdown") {
    return { ...base, breakdown: [], breakdownAvailable: false };
  }
  const breakdown = [
    {
      muscleGroup: "chest",
      volumeKg: 4200,
      sets: 7,
      shareOfSession: 0.42,
      mappingStatus: "catalogue" as const,
    },
    {
      muscleGroup: "back",
      volumeKg: 3100,
      sets: 6,
      shareOfSession: 0.31,
      mappingStatus: "catalogue" as const,
    },
    {
      muscleGroup: "shoulders",
      volumeKg: 1800,
      sets: 4,
      shareOfSession: 0.18,
      mappingStatus: "catalogue" as const,
    },
    {
      muscleGroup: "arms",
      volumeKg: 900,
      sets: 3,
      shareOfSession: 0.09,
      mappingStatus: "catalogue" as const,
    },
  ];
  if (mode === "partial") {
    // One set with no known volume makes the whole denominator incomplete.
    return {
      ...base,
      breakdownAvailable: true,
      breakdown: breakdown.map((row, index) =>
        index === 1 ? { ...row, volumeKg: null, shareOfSession: null } : row,
      ),
    };
  }
  return { ...base, breakdown, breakdownAvailable: true };
};

/** `?evidence=fail|some` drives the prediction evidence panel. The default is
 *  this account's state: predictions made for one target, none resolved. */
export const getEvidenceReport = async () => {
  const mode = new URLSearchParams(window.location.search).get("evidence");
  if (mode === "fail") throw new Error("ledger unavailable");
  const target = (name, captured, evaluated, pending, level, modelled) => ({
    target: name,
    modelled,
    level,
    captured,
    evaluated,
    pending,
    minimumEvaluated: 8,
  });
  if (mode === "some") {
    return {
      status: "counted" as const,
      targets: [
        target("workout_completion", 40, 18, 22, "moderate", true),
        target("exercise_performance", 12, 9, 3, "early", true),
        target("readiness", 0, 0, 0, "insufficient", false),
        target("short_term_fatigue", 0, 0, 0, "insufficient", false),
      ],
    };
  }
  return {
    status: "counted" as const,
    targets: [
      target("workout_completion", 39, 0, 39, "insufficient", true),
      target("exercise_performance", 0, 0, 0, "insufficient", false),
      target("readiness", 0, 0, 0, "insufficient", false),
      target("short_term_fatigue", 0, 0, 0, "insufficient", false),
    ],
  };
};

/** `?sleep=fail|duration|partial|staged` drives the sleep panel. The default
 *  is this account's state: no source has ever sent a night. */
export const getSleepNight = async () => {
  const mode = new URLSearchParams(window.location.search).get("sleep");
  if (mode === "fail") throw new Error("samples unavailable");
  const night = { night: "2026-09-06", source: "apple_health", ageDays: 1 };
  if (mode === "duration") {
    return { status: "duration_only" as const, ...night, sleepHours: 7.2 };
  }
  if (mode === "partial") {
    // One stage out of four, and 350 minutes of reported sleep that the source
    // never placed anywhere.
    return {
      status: "staged" as const,
      ...night,
      sleepHours: 7.2,
      slices: [{ stage: "deep" as const, minutes: 82, share: null }],
      stagedMinutes: 82,
      unattributedMinutes: 350,
    };
  }
  if (mode === "staged") {
    return {
      status: "staged" as const,
      ...night,
      sleepHours: 7.6,
      slices: [
        { stage: "deep" as const, minutes: 82, share: 82 / 458 },
        { stage: "rem" as const, minutes: 96, share: 96 / 458 },
        { stage: "core" as const, minutes: 256, share: 256 / 458 },
        { stage: "awake" as const, minutes: 24, share: 24 / 458 },
      ],
      stagedMinutes: 458,
      unattributedMinutes: null,
    };
  }
  return { status: "absent" as const };
};
