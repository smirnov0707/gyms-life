import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { AthletePredictionSchema } from "./prediction.schema";
import { PersonalCompletionArtifactSchema } from "./personal-completion-model.schema";

const io = vi.hoisted(() => ({ artifact: vi.fn() }));
vi.mock("./personal-completion-model.server", () => ({
  loadActivePersonalCompletionArtifact: io.artifact,
}));
import {
  capturePersonalCompletionShadowPrediction,
  reviewPendingPersonalCompletionPredictions,
} from "./personal-completion-prediction.server";

const USER = "11111111-1111-4111-8111-111111111111";
const DECISION = "22222222-2222-4222-8222-222222222222";
const ARTIFACT = "33333333-3333-4333-8333-333333333333";
const SNAPSHOT = "44444444-4444-4444-8444-444444444444";
const baseline = AthletePredictionSchema.parse({
  id: "55555555-5555-4555-8555-555555555555",
  target: "workout_completion",
  generatedAt: "2026-09-15T08:00:00Z",
  horizonEndsAt: "2026-09-15T22:00:00Z",
  modelId: "workout-completion-usual-day-baseline",
  modelVersion: "0.1.0",
  maturity: "shadow",
  athleteStateSnapshotId: SNAPSHOT,
  evidenceLevel: "moderate",
  evidence: [],
  predicted: { kind: "probability", value: 0.5 },
  actual: null,
  evaluatedAt: null,
});
const artifact = PersonalCompletionArtifactSchema.parse({
  id: ARTIFACT,
  modelId: "workout-completion-personal-logit-offset",
  algorithmVersion: "0.1.0",
  sourceModelId: "workout-completion-usual-day-baseline",
  sourceModelVersion: "0.1.0",
  status: "shadow",
  trainingStartOn: "2026-08-01",
  trainedThrough: "2026-09-01",
  trainingDays: 20,
  positiveDays: 15,
  negativeDays: 5,
  evidenceFingerprint: "a".repeat(64),
  parameters: { kind: "logit_offset_v1", logOddsOffset: 0.2, ridgePenalty: 4 },
  createdAt: "2026-09-01T23:00:00Z",
});

function captureClient(options?: { storedPrediction?: unknown; rpcError?: boolean }) {
  let storedPrediction: unknown = options?.storedPrediction;
  const calls: Array<{ table: string; methods: Array<[string, unknown[]]> }> = [];
  const from = vi.fn((table: string) => {
    const methods: Array<[string, unknown[]]> = [];
    calls.push({ table, methods });
    const query = new Proxy(
      {},
      {
        get: (_target, key) => {
          if (key === "then") {
            const response =
              table === "decision_records"
                ? {
                    data: { id: DECISION, decision_on: "2026-09-15", prediction: baseline },
                    error: null,
                  }
                : {
                    data: storedPrediction
                      ? {
                          id: (storedPrediction as { id: string }).id,
                          user_id: USER,
                          artifact_id: ARTIFACT,
                          decision_id: DECISION,
                          decision_on: "2026-09-15",
                          prediction: storedPrediction,
                        }
                      : null,
                    error: null,
                  };
            return Promise.resolve(response).then.bind(Promise.resolve(response));
          }
          return (...args: unknown[]) => {
            methods.push([String(key), args]);
            return query;
          };
        },
      },
    );
    return query;
  });
  const rpc = vi.fn(async (_name: string, args: { p_prediction: unknown }) => {
    storedPrediction = args.p_prediction;
    return options?.rpcError
      ? { data: null, error: { message: "synthetic" } }
      : { data: (args.p_prediction as { id: string }).id, error: null };
  });
  return { client: { from, rpc } as unknown as SupabaseClient<Database>, calls, rpc };
}

beforeEach(() => {
  io.artifact.mockReset().mockResolvedValue(artifact);
});

describe("personal challenger capture", () => {
  it("reads the exact stored baseline and writes a deterministic separate challenger", async () => {
    const db = captureClient();
    expect(
      await capturePersonalCompletionShadowPrediction({
        client: db.client,
        userId: USER,
        decisionId: DECISION,
        decisionOn: "2026-09-15",
      }),
    ).toBe(true);
    expect(db.rpc).toHaveBeenCalledTimes(1);
    const args = db.rpc.mock.calls[0]![1];
    expect(args.p_prediction).toMatchObject({
      modelId: "workout-completion-personal-logit-offset",
      generatedAt: baseline.generatedAt,
      horizonEndsAt: baseline.horizonEndsAt,
      actual: null,
    });
    expect((args.p_prediction as { id: string }).id).not.toBe(baseline.id);
  });

  it("does not use training-period decisions as holdout evidence", async () => {
    const db = captureClient();
    expect(
      await capturePersonalCompletionShadowPrediction({
        client: db.client,
        userId: USER,
        decisionId: DECISION,
        decisionOn: artifact.trainedThrough,
      }),
    ).toBe(false);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("fails closed when the write is not confirmed", async () => {
    const db = captureClient({ rpcError: true });
    await expect(
      capturePersonalCompletionShadowPrediction({
        client: db.client,
        userId: USER,
        decisionId: DECISION,
        decisionOn: "2026-09-15",
      }),
    ).rejects.toThrow("PERSONAL_MODEL_PREDICTION_WRITE_FAILED");
  });
});

function reviewClient(options: {
  challenger: ReturnType<typeof AthletePredictionSchema.parse>;
  challengers?: ReturnType<typeof AthletePredictionSchema.parse>[];
  rawPending?: Array<{ id: string; prediction: unknown }>;
  sessions?: Array<{ finished_at: string }>;
  updateRows?: Array<{ id: string }>;
  sessionError?: boolean;
}) {
  const methods: Array<{ table: string; kind: string; payload?: unknown }> = [];
  const from = vi.fn((table: string) => {
    let kind = "select",
      payload: unknown,
      matchedId: string | undefined;
    const result = () => {
      methods.push({ table, kind, payload });
      if (table === "personal_model_predictions" && kind === "select")
        return {
          data:
            options.rawPending ??
            (options.challengers ?? [options.challenger]).map((prediction) => ({
              id: prediction.id,
              prediction,
            })),
          error: null,
        };
      if (table === "workout_sessions")
        return {
          data: options.sessionError ? null : (options.sessions ?? []),
          error: options.sessionError ? { message: "synthetic" } : null,
        };
      if (table === "personal_model_predictions" && kind === "update")
        return {
          data: options.updateRows ?? [{ id: matchedId ?? options.challenger.id }],
          error: null,
        };
      throw new Error(`Unexpected ${table}:${kind}`);
    };
    const query = new Proxy(
      {},
      {
        get: (_target, key) => {
          if (key === "then") {
            const response = Promise.resolve().then(result);
            return response.then.bind(response);
          }
          return (...args: unknown[]) => {
            if (key === "eq" && args[0] === "id") matchedId = String(args[1]);
            if (key === "update") {
              kind = "update";
              payload = args[0];
            }
            return query;
          };
        },
      },
    );
    return query;
  });
  return { client: { from } as unknown as SupabaseClient<Database>, methods };
}
const challenger = AthletePredictionSchema.parse({
  ...baseline,
  id: "66666666-6666-4666-8666-666666666666",
  modelId: "workout-completion-personal-logit-offset",
  modelVersion: "0.1.0+33333333",
  predicted: { kind: "probability", value: 0.61 },
});

describe("personal challenger outcome review", () => {
  it("leaves an open horizon pending when no workout has finished yet", async () => {
    const db = reviewClient({ challenger, sessions: [] });
    expect(
      await reviewPendingPersonalCompletionPredictions(
        db.client,
        USER,
        new Date("2026-09-15T12:00:00Z"),
      ),
    ).toMatchObject({ checked: 1, evaluated: 0, limited: false });
    expect(db.methods.some((call) => call.kind === "update")).toBe(false);
  });

  it("records a positive actual from a canonical completion inside the horizon", async () => {
    const db = reviewClient({ challenger, sessions: [{ finished_at: "2026-09-15T18:00:00Z" }] });
    expect(
      await reviewPendingPersonalCompletionPredictions(
        db.client,
        USER,
        new Date("2026-09-16T01:00:00Z"),
      ),
    ).toMatchObject({ checked: 1, evaluated: 1, limited: false });
    const update = db.methods.find((call) => call.kind === "update")?.payload as {
      prediction: { actual: { kind: string; value: boolean }; evaluatedAt: string };
    };
    expect(update.prediction.actual).toEqual({ kind: "boolean", value: true });
    expect(update.prediction.evaluatedAt).toBe("2026-09-15T18:00:00Z");
  });

  it("records non-completion only after the forecast horizon closes", async () => {
    const db = reviewClient({ challenger, sessions: [] });
    expect(
      await reviewPendingPersonalCompletionPredictions(
        db.client,
        USER,
        new Date("2026-09-16T01:00:00Z"),
      ),
    ).toMatchObject({ checked: 1, evaluated: 1, limited: false });
    const update = db.methods.find((call) => call.kind === "update")?.payload as {
      prediction: { actual: { kind: string; value: boolean } };
    };
    expect(update.prediction.actual).toEqual({ kind: "boolean", value: false });
  });

  it("treats a malformed pending challenger as unavailable evidence instead of silently skipping it", async () => {
    const db = reviewClient({
      challenger,
      rawPending: [
        {
          id: challenger.id,
          prediction: { ...challenger, predicted: { kind: "probability", value: "corrupt" } },
        },
      ],
      sessions: [],
    });
    await expect(
      reviewPendingPersonalCompletionPredictions(db.client, USER, new Date("2026-09-16T01:00:00Z")),
    ).rejects.toThrow("PERSONAL_MODEL_PENDING_INVALID");
    expect(db.methods.some((call) => call.kind === "update")).toBe(false);
  });

  it("does not interpret an unavailable workout read as non-completion", async () => {
    const db = reviewClient({ challenger, sessionError: true });
    await expect(
      reviewPendingPersonalCompletionPredictions(db.client, USER, new Date("2026-09-16T01:00:00Z")),
    ).rejects.toThrow("PERSONAL_MODEL_COMPLETIONS_UNAVAILABLE");
    expect(db.methods.some((call) => call.kind === "update")).toBe(false);
  });

  it("does not count another worker's zero-row update as a new evaluation", async () => {
    const db = reviewClient({ challenger, sessions: [], updateRows: [] });
    expect(
      await reviewPendingPersonalCompletionPredictions(
        db.client,
        USER,
        new Date("2026-09-16T01:00:00Z"),
      ),
    ).toMatchObject({ checked: 1, evaluated: 0, limited: false });
  });

  it("processes the oldest bounded batch instead of deadlocking when more than 64 predictions accumulated", async () => {
    const challengers = Array.from({ length: 65 }, (_, index) =>
      AthletePredictionSchema.parse({
        ...challenger,
        id: `70000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        generatedAt: `2026-07-${String((index % 28) + 1).padStart(2, "0")}T08:00:00Z`,
        horizonEndsAt: `2026-07-${String((index % 28) + 1).padStart(2, "0")}T22:00:00Z`,
      }),
    );
    const db = reviewClient({ challenger, challengers, sessions: [] });
    expect(
      await reviewPendingPersonalCompletionPredictions(
        db.client,
        USER,
        new Date("2026-09-16T01:00:00Z"),
      ),
    ).toMatchObject({ checked: 64, evaluated: 64, limited: true });
    expect(db.methods.filter((call) => call.kind === "update")).toHaveLength(64);
  });
});
