import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { AthletePredictionSchema } from "./prediction.schema";
import { PersonalCompletionArtifactSchema } from "./personal-completion-model.schema";
import { ensurePersonalCompletionLearning } from "./personal-completion-model.server";

const USER = "11111111-1111-4111-8111-111111111111";
const CURRENT_ID = "22222222-2222-4222-8222-222222222222";
const days = Array.from({ length: 40 }, (_, index) => {
  const date = new Date("2026-07-01T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + index);
  return date.toISOString().slice(0, 10);
});
function baseline(index: number, actual: boolean, probability = 0.5) {
  const day = days[index]!;
  return {
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    decision_on: day,
    created_at: `${day}T07:00:00Z`,
    prediction: AthletePredictionSchema.parse({
      id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      target: "workout_completion",
      generatedAt: `${day}T08:00:00Z`,
      horizonEndsAt: `${day}T22:00:00Z`,
      modelId: "workout-completion-usual-day-baseline",
      modelVersion: "0.1.0",
      maturity: "shadow",
      athleteStateSnapshotId: null,
      evidenceLevel: "moderate",
      evidence: [],
      predicted: { kind: "probability", value: probability },
      actual: { kind: "boolean", value: actual },
      evaluatedAt: `${day}T23:00:00Z`,
    }),
  };
}
const currentArtifact = PersonalCompletionArtifactSchema.parse({
  id: CURRENT_ID,
  modelId: "workout-completion-personal-logit-offset",
  algorithmVersion: "0.1.0",
  sourceModelId: "workout-completion-usual-day-baseline",
  sourceModelVersion: "0.1.0",
  status: "shadow",
  trainingStartOn: days[0],
  trainedThrough: days[11],
  trainingDays: 12,
  positiveDays: 8,
  negativeDays: 4,
  evidenceFingerprint: "a".repeat(64),
  parameters: { kind: "logit_offset_v1", logOddsOffset: 0.15, ridgePenalty: 4 },
  createdAt: "2026-07-12T23:30:00Z",
});
function artifactRow(artifact = currentArtifact) {
  return {
    id: artifact.id,
    model_id: artifact.modelId,
    algorithm_version: artifact.algorithmVersion,
    source_model_id: artifact.sourceModelId,
    source_model_version: artifact.sourceModelVersion,
    status: artifact.status,
    training_start_on: artifact.trainingStartOn,
    trained_through: artifact.trainedThrough,
    training_days: artifact.trainingDays,
    positive_days: artifact.positiveDays,
    negative_days: artifact.negativeDays,
    evidence_fingerprint: artifact.evidenceFingerprint,
    parameters: artifact.parameters,
    created_at: artifact.createdAt,
  };
}
function challenger(index: number, actual: boolean, probability: number) {
  const base = baseline(index, actual).prediction;
  return {
    decision_id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    decision_on: days[index]!,
    created_at: `${days[index]}T08:01:00Z`,
    prediction: AthletePredictionSchema.parse({
      ...base,
      id: `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      modelId: "workout-completion-personal-logit-offset",
      modelVersion: "0.1.0+22222222",
      predicted: { kind: "probability", value: probability },
    }),
  };
}
function learningClient(options: {
  history: ReturnType<typeof baseline>[];
  active?: ReturnType<typeof artifactRow> | null;
  holdout?: ReturnType<typeof challenger>[];
  omitBaselinePairs?: boolean;
}) {
  let active = options.active ?? null;
  const calls: Array<{ table: string; kind: string; methods: Array<[string, unknown[]]> }> = [];
  const from = vi.fn((table: string) => {
    let kind = "select",
      payload: unknown;
    const methods: Array<[string, unknown[]]> = [];
    const resolve = () => {
      calls.push({ table, kind, methods: structuredClone(methods) });
      if (table === "decision_records") {
        const pairedLookup = methods.some(([name]) => name === "in");
        if (!pairedLookup) return { data: options.history, error: null };
        const ids = new Set(
          (methods.find(([name]) => name === "in")?.[1][1] as string[] | undefined) ?? [],
        );
        if (options.omitBaselinePairs) return { data: [], error: null };
        return {
          data: (options.holdout ?? []).flatMap((row) => {
            if (!ids.has(row.decision_id)) return [];
            const index = days.indexOf(row.decision_on);
            return index < 0
              ? []
              : [
                  {
                    id: row.decision_id,
                    decision_on: row.decision_on,
                    prediction: options.history[index]?.prediction,
                  },
                ];
          }),
          error: null,
        };
      }
      if (table === "personal_model_predictions")
        return { data: options.holdout ?? [], error: null };
      if (table === "personal_model_artifacts" && kind === "select")
        return { data: active, error: null };
      if (table === "personal_model_artifacts" && kind === "insert") {
        const row = payload as Record<string, unknown>;
        active = {
          id: row["id"],
          model_id: row["model_id"],
          algorithm_version: row["algorithm_version"],
          source_model_id: row["source_model_id"],
          source_model_version: row["source_model_version"],
          status: row["status"],
          training_start_on: row["training_start_on"],
          trained_through: row["trained_through"],
          training_days: row["training_days"],
          positive_days: row["positive_days"],
          negative_days: row["negative_days"],
          evidence_fingerprint: row["evidence_fingerprint"],
          parameters: row["parameters"],
          created_at: "2026-09-20T00:00:00Z",
        } as ReturnType<typeof artifactRow>;
        return { data: null, error: null };
      }
      throw new Error(`Unexpected ${table}:${kind}`);
    };
    const query = new Proxy(
      {},
      {
        get: (_target, key) => {
          if (key === "then") {
            const response = Promise.resolve().then(resolve);
            return response.then.bind(response);
          }
          return (...args: unknown[]) => {
            methods.push([String(key), args]);
            if (key === "insert") {
              kind = "insert";
              payload = args[0];
            }
            return query;
          };
        },
      },
    );
    return query;
  });
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (name === "read_personal_completion_training_observations") {
      const throughOn = String(args["p_through_on"]);
      const limit = Number(args["p_limit_days"]);
      const rows = options.history
        .filter((row) => row.decision_on <= throughOn)
        .slice()
        .sort((a, b) => b.decision_on.localeCompare(a.decision_on))
        .slice(0, limit)
        .map((row) => ({ decision_on: row.decision_on, prediction: row.prediction }));
      return { data: rows, error: null };
    }
    if (name === "qualify_personal_completion_artifact") {
      if (!active || active.id !== args["p_artifact_id"]) return { data: false, error: null };
      active = { ...active, status: "qualified" };
      return { data: true, error: null };
    }
    if (name === "rotate_personal_completion_artifact") {
      if (!active || active.id !== args["p_previous_artifact_id"])
        return { data: null, error: { message: "synthetic previous missing" } };
      const next = PersonalCompletionArtifactSchema.parse(args["p_artifact"]);
      active = artifactRow(next);
      return { data: next.id, error: null };
    }
    throw new Error(`Unexpected RPC ${name}`);
  });
  return {
    client: { from, rpc } as unknown as SupabaseClient<Database>,
    calls,
    rpc,
    active: () => active,
  };
}

beforeEach(() => vi.restoreAllMocks());

describe("personal model learning lifecycle", () => {
  it("requests a 365-unique-day window ending before the athlete's current local day", async () => {
    const db = learningClient({
      history: Array.from({ length: 12 }, (_, index) => baseline(index, index < 8)),
    });
    await ensurePersonalCompletionLearning(
      db.client,
      USER,
      new Date("2026-09-10T00:30:00Z"),
      "America/Los_Angeles",
    );
    expect(db.rpc).toHaveBeenCalledWith("read_personal_completion_training_observations", {
      p_user_id: USER,
      p_through_on: "2026-09-08",
      p_limit_days: 365,
    });
  });
  it("distinguishes insufficient history from one-sided history", async () => {
    const short = learningClient({
      history: Array.from({ length: 8 }, (_, i) => baseline(i, true)),
    });
    expect(await ensurePersonalCompletionLearning(short.client, USER)).toMatchObject({
      state: "insufficient_history",
      evaluatedDays: 8,
    });
    const oneSided = learningClient({
      history: Array.from({ length: 12 }, (_, i) => baseline(i, true)),
    });
    expect(await ensurePersonalCompletionLearning(oneSided.client, USER)).toMatchObject({
      state: "insufficient_variation",
      evaluatedDays: 12,
      positiveDays: 12,
      negativeDays: 0,
    });
  });

  it("trains the first shadow candidate only after mixed evaluated history", async () => {
    const history = Array.from({ length: 12 }, (_, index) => baseline(index, index < 8));
    const db = learningClient({ history });
    const result = await ensurePersonalCompletionLearning(
      db.client,
      USER,
      new Date("2026-09-20T00:00:00Z"),
    );
    expect(result).toMatchObject({
      state: "trained_shadow",
      artifact: { status: "shadow", trainingDays: 12, positiveDays: 8, negativeDays: 4 },
    });
    expect(db.active()).not.toBeNull();
    expect(db.rpc).not.toHaveBeenCalledWith(
      "qualify_personal_completion_artifact",
      expect.anything(),
    );
    expect(db.rpc).not.toHaveBeenCalledWith(
      "rotate_personal_completion_artifact",
      expect.anything(),
    );
  });

  it("qualifies only after paired future outcomes pass the predeclared holdout rule", async () => {
    const history = Array.from({ length: 32 }, (_, index) => baseline(index, index < 24));
    const holdout = Array.from({ length: 20 }, (_, offset) => {
      const index = offset + 12;
      const actual = index < 24;
      return challenger(index, actual, actual ? 0.82 : 0.18);
    });
    const db = learningClient({ history, active: artifactRow(), holdout });
    const result = await ensurePersonalCompletionLearning(
      db.client,
      USER,
      new Date("2026-09-20T00:00:00Z"),
    );
    expect(result).toMatchObject({
      state: "qualified_shadow",
      artifact: { id: CURRENT_ID, status: "qualified" },
      holdout: { pairedDays: 20, promotionEligible: true },
    });
    expect(db.rpc).toHaveBeenCalledWith(
      "qualify_personal_completion_artifact",
      expect.objectContaining({ p_user_id: USER, p_artifact_id: CURRENT_ID }),
    );
    expect(db.rpc).not.toHaveBeenCalledWith(
      "rotate_personal_completion_artifact",
      expect.anything(),
    );
  });

  it("retires an unproven candidate and trains a new shadow model on expanded history", async () => {
    const history = Array.from({ length: 32 }, (_, index) => baseline(index, index % 3 !== 0));
    const holdout = Array.from({ length: 20 }, (_, offset) => {
      const index = offset + 12;
      return challenger(index, index % 3 !== 0, 0.5);
    });
    const db = learningClient({ history, active: artifactRow(), holdout });
    const result = await ensurePersonalCompletionLearning(
      db.client,
      USER,
      new Date("2026-09-20T00:00:00Z"),
    );
    expect(result).toMatchObject({
      state: "retrained_shadow",
      retiredArtifactId: CURRENT_ID,
      artifact: { status: "shadow", trainedThrough: days[31], trainingDays: 32 },
      previousHoldout: { pairedDays: 20, promotionEligible: false },
    });
    expect(db.rpc).toHaveBeenCalledWith(
      "rotate_personal_completion_artifact",
      expect.objectContaining({ p_user_id: USER, p_previous_artifact_id: CURRENT_ID }),
    );
    expect(db.active()?.id).not.toBe(CURRENT_ID);
  });

  it("does not silently shrink holdout evidence when a committed challenger loses its baseline pair", async () => {
    const history = Array.from({ length: 19 }, (_, index) => baseline(index, index % 3 !== 0));
    const holdout = Array.from({ length: 7 }, (_, offset) => {
      const index = offset + 12;
      return challenger(index, index % 3 !== 0, 0.55);
    });
    const db = learningClient({ history, active: artifactRow(), holdout, omitBaselinePairs: true });
    expect(await ensurePersonalCompletionLearning(db.client, USER)).toEqual({
      state: "unavailable",
    });
    expect(
      db.rpc.mock.calls.filter(
        ([name]) => name !== "read_personal_completion_training_observations",
      ),
    ).toHaveLength(0);
  });

  it("keeps collecting forward evidence before the holdout threshold", async () => {
    const history = Array.from({ length: 19 }, (_, index) => baseline(index, index % 3 !== 0));
    const holdout = Array.from({ length: 7 }, (_, offset) => {
      const index = offset + 12;
      return challenger(index, index % 3 !== 0, 0.55);
    });
    const db = learningClient({ history, active: artifactRow(), holdout });
    const result = await ensurePersonalCompletionLearning(db.client, USER);
    expect(result).toMatchObject({
      state: "shadow_learning",
      artifact: { id: CURRENT_ID, status: "shadow" },
      holdout: { pairedDays: 7, baselineBrier: null, challengerBrier: null },
    });
    expect(db.rpc).not.toHaveBeenCalledWith(
      "qualify_personal_completion_artifact",
      expect.anything(),
    );
    expect(db.rpc).not.toHaveBeenCalledWith(
      "rotate_personal_completion_artifact",
      expect.anything(),
    );
  });
});
