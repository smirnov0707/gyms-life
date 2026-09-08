import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/integrations/supabase/types";
import type { DigitalAthleteSources } from "./digital-athlete.schema";
import { buildDigitalAthleteState, loadDigitalAthleteState } from "./digital-athlete.service";
import {
  fingerprintDigitalAthleteState,
  refreshAthleteStateSnapshot,
} from "./athlete-state-snapshot.server";
import { getOrCreateTodayDecision } from "./today-decision.server";
import { buildTodayDecision } from "./today-decision.engine";

const { adminFrom, reconcileMemory } = vi.hoisted(() => ({
  adminFrom: vi.fn(),
  reconcileMemory: vi.fn(),
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: adminFrom },
}));
vi.mock("./digital-athlete.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./digital-athlete.service")>()),
  loadDigitalAthleteState: vi.fn(),
}));
vi.mock("./deterministic-memory.service", () => ({
  reconcileCalculatedUserMemory: reconcileMemory,
}));
vi.mock("./active-plan.service", () => ({
  getActivePlanWorkoutProgress: vi.fn(async () => ({ status: "NO_ACTIVE_PLAN" })),
}));
vi.mock("./prediction-shadow-ledger.server", () => ({
  reconcileWorkoutCompletionShadowPredictions: vi.fn(async () => 0),
  captureWorkoutCompletionShadowPrediction: vi.fn(),
}));

const userId = "11111111-1111-4111-8111-111111111111";
const snapshotId = "22222222-2222-4222-8222-222222222222";
const now = new Date("2026-09-08T09:00:00.000Z");
const timeZone = "Europe/Vilnius";
const supabase = createClient<Database>("https://availability-test.invalid", "test-anon-key", {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: {
    fetch: async () => {
      throw new Error("Unexpected network access in availability regression test.");
    },
  },
});

const readableSources: DigitalAthleteSources = {
  workouts: [],
  workoutResponses: [],
  checkins: [],
  bodyMetrics: [],
  nutritionLogs: [],
  decisionFeedback: [],
  lifeContexts: [],
  trainingRhythm: null,
  setLogs: [],
  exerciseMuscleGroups: [],
  availability: {
    training: true,
    recovery: true,
    body: true,
    nutrition: true,
    decisionFeedback: true,
    context: true,
    trainingRhythm: true,
    trainingResponse: true,
    muscleLoad: true,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  adminFrom.mockImplementation(() => {
    throw new Error("Unavailable source must not reach snapshot or decision persistence.");
  });
  reconcileMemory.mockResolvedValue({ candidateCount: 0 });
});

describe("source availability through snapshot and Today services", () => {
  it.each([
    "training",
    "recovery",
    "body",
    "nutrition",
    "context",
    "trainingRhythm",
    "muscleLoad",
  ] satisfies Array<keyof DigitalAthleteSources["availability"]>)(
    "withholds snapshot, memory and Today persistence when %s is unreadable",
    async (domain) => {
      const state = buildDigitalAthleteState(
        {
          ...readableSources,
          availability: { ...readableSources.availability, [domain]: false },
        },
        now,
        timeZone,
      );
      vi.mocked(loadDigitalAthleteState).mockResolvedValue(state);

      await expect(refreshAthleteStateSnapshot(supabase, userId, timeZone, now)).resolves.toEqual({
        state,
        evaluatedAt: now.toISOString(),
        snapshot: null,
      });
      await expect(getOrCreateTodayDecision(supabase, userId, timeZone, now)).rejects.toThrow(
        "Today decision is unavailable until all athlete data sources respond.",
      );
      expect(adminFrom).not.toHaveBeenCalled();
      expect(reconcileMemory).not.toHaveBeenCalled();
    },
  );

  it("persists a readable cold start and permits the normal onboarding decision", async () => {
    const state = buildDigitalAthleteState(readableSources, now, timeZone);
    vi.mocked(loadDigitalAthleteState).mockResolvedValue(state);
    const query = {
      upsert: vi.fn(async () => ({ error: null })),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => ({
        error: null,
        data: {
          id: snapshotId,
          schema_version: state.schemaVersion,
          state,
          state_fingerprint: fingerprintDigitalAthleteState(state),
          computed_at: now.toISOString(),
        },
      })),
    };
    adminFrom.mockReturnValue(query);

    const result = await refreshAthleteStateSnapshot(supabase, userId, timeZone, now);

    expect(result.snapshot?.id).toBe(snapshotId);
    expect(query.upsert).toHaveBeenCalledOnce();
    expect(reconcileMemory).toHaveBeenCalledWith(userId, state, result.snapshot);
    expect(
      buildTodayDecision({
        state: result.state,
        hasActiveTrainingPlan: false,
        hasOpenWorkout: false,
        activePlanDaysPerWeek: null,
        activePlanSessionsLast7Days: null,
      }).action,
    ).toBe("generate_training_plan");
  });
});
