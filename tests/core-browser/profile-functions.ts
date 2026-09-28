// Synthetic profile presentation inputs. Never connected to a live account.
import { z } from "zod";
import { buildDigitalAthleteState } from "../../src/lib/digital-athlete.service";
import type { AthleteModelResponse } from "../../src/lib/athlete-model.contract";
import type { UserMemoryTransparencyItem } from "../../src/lib/user-memory.schema";
import { count, state } from "./state";
const now = new Date("2026-09-26T12:00:00Z");
// Client form only; server-side profile validation remains covered by its own tests.
export const ProfileBodySchema = z.object({
  heightCm: z.number().int().min(120).max(230).nullable(),
  birthYear: z
    .number()
    .int()
    .min(new Date().getUTCFullYear() - 100)
    .max(new Date().getUTCFullYear() - 10)
    .nullable(),
  gender: z.enum(["male", "female", "other"]).nullable(),
  targetWeightKg: z.number().min(30).max(300).nullable(),
});
export async function getProfileBody() {
  return {
    heightCm: state.profile.height_cm,
    birthYear: state.profile.birth_year,
    gender: state.profile.gender,
    targetWeightKg: state.profile.target_weight_kg,
  };
}
export async function saveProfileBody({ data }: { data: z.infer<typeof ProfileBodySchema> }) {
  count("saveProfileBody");
  state.last["saveProfileBody"] = data;
  return { ok: true };
}
export async function getAthleteModel(): Promise<AthleteModelResponse> {
  return {
    evaluatedAt: now.toISOString(),
    snapshot: {
      id: "44444444-4444-4444-8444-444444444444",
      schemaVersion: "1.7",
      computedAt: now.toISOString(),
    },
    state: buildDigitalAthleteState(
      {
        workouts: [{ started_at: "2026-09-25T12:00:00Z", total_volume: 4200 }],
        workoutResponses: [],
        checkins: [{ checkin_on: "2026-09-26", readiness_score: 72, sleep_hours: 7.5 }],
        bodyMetrics: [{ measured_on: "2026-09-24", weight_kg: 68, body_fat: null }],
        nutritionLogs: [{ logged_on: "2026-09-26", calories: 2000, protein: 100 }],
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
      },
      now,
      "Europe/Vilnius",
    ),
  };
}
export async function getUserMemoryTransparency() {
  const items: UserMemoryTransparencyItem[] = [
    {
      id: "55555555-5555-4555-8555-555555555555",
      type: "preference",
      content: "Synthetic preference: train in the morning.",
      source: "user_reported",
      evidenceState: "user_confirmed",
      importance: 0.7,
      status: "active",
      calculatedValue: null,
      evidenceCount: 1,
      lastConfirmedAt: now.toISOString(),
      expiresAt: null,
    },
  ];
  return { items, hasMore: false, limit: 12 };
}
export async function getTrainingRhythm() {
  return null;
}
export async function getHealthSource() {
  return { status: "unavailable" };
}
export async function getOvernightWork() {
  return { state: "never" };
}
