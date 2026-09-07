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
  return LIVE_SIGNAL_IDS.map((id) => ({
    id,
    state: "absent" as const,
    value: null,
    recordedOn: null,
    ageDays: null,
    delta: null,
    source: null,
  }));
};

export const getTwinSnapshot = async () => ({
  calculationVersion: "TEST-FIXTURE-NOT-USER-DATA",
  bodyVariant: "male" as const,
  computedAt: "2026-09-07T06:00:00.000Z",
  evidenceWindowDays: 14,
  dataAvailable: true,
  regions: [],
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

export const getLabOverview = async () => null;
export const getTwinTrendHistory = async () => null;
export const getTodaysWorkout = async () => ({ status: "NO_PLAN" as const });
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
