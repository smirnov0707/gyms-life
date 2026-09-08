import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database, Json } from "@/integrations/supabase/types";
import type { AthleteModelResponse } from "./athlete-model.contract";
import {
  DigitalAthleteStateSchema,
  type DigitalAthleteDataGap,
  type DigitalAthleteState,
} from "./digital-athlete.schema";
import {
  DIGITAL_ATHLETE_CALCULATION_VERSION,
  DIGITAL_ATHLETE_MAX_LOOKBACK_DAYS,
  loadDigitalAthleteState,
} from "./digital-athlete.service";

const AthleteStateSnapshotSchema = z
  .object({
    id: z.string().uuid(),
    schema_version: z.string().regex(/^[1-9][0-9]*\.[0-9]+$/),
    state: DigitalAthleteStateSchema,
    state_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    computed_at: z.string().min(1),
  })
  .strict();

/**
 * Compact, real metadata about how a snapshot was derived. `provenance`
 * mirrors the domains the calculation actually had data for and the gaps it
 * found; `uncertainty` mirrors the existing data-quality signal. Neither
 * value is invented for display — both already drive the deterministic
 * Today decision engine.
 */
function provenanceSummary(state: DigitalAthleteState): Record<string, unknown> {
  return {
    availableDomains: state.dataQuality.availableDomains,
    dataGaps: state.dataGaps,
  };
}

function uncertaintySummary(state: DigitalAthleteState): Record<string, unknown> {
  return {
    dataQualityLevel: state.dataQuality.level,
    evidenceCount: state.dataQuality.evidenceCount,
  };
}

/**
 * The widest lookback window any domain calculation used to derive this
 * state. This is a coarse outer bound for audit/replay, not a precise
 * per-source-record range.
 */
function sourceWindow(now: Date): { start: string; end: string } {
  return {
    start: new Date(now.getTime() - DIGITAL_ATHLETE_MAX_LOOKBACK_DAYS * 86_400_000).toISOString(),
    end: now.toISOString(),
  };
}

type AthleteStateSnapshot = z.infer<typeof AthleteStateSnapshotSchema>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Converts a validated domain value to Supabase's Json contract without casts. */
function toJson(value: unknown): Json {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) return value.map(toJson);
  if (isRecord(value)) {
    const output: { [key: string]: Json | undefined } = {};
    for (const [key, nestedValue] of Object.entries(value)) output[key] = toJson(nestedValue);
    return output;
  }
  throw new Error("Digital athlete state contains a non-JSON value.");
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw new Error("Digital athlete state is not serializable.");
    return serialized;
  }
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  throw new Error("Digital athlete state is not serializable.");
}

/** A source-state digest lets one evolving state be stored only once. */
export function fingerprintDigitalAthleteState(
  state: DigitalAthleteState,
  calculationVersion: string = DIGITAL_ATHLETE_CALCULATION_VERSION,
): string {
  // Identical values under a different derivation must retain their own model
  // identity. Existing snapshots are immutable; no historical row is rewritten.
  return createHash("sha256").update(stableJson({ calculationVersion, state })).digest("hex");
}

/**
 * Every gap requires an explicit persistence decision. Naming conventions are
 * not an availability contract: body and life-context failures do not contain
 * `_data_`, and missing life context can hide a current safety limitation.
 * `satisfies` makes adding a new gap without classifying it a compile error.
 */
const DATA_GAP_KIND = {
  training_data_unavailable: "source_unavailable",
  no_completed_workouts_28d: "no_observations",
  recovery_data_unavailable: "source_unavailable",
  no_recovery_checkins_7d: "no_observations",
  body_measurements_unavailable: "source_unavailable",
  no_body_measurements_30d: "no_observations",
  nutrition_data_unavailable: "source_unavailable",
  no_nutrition_logs_14d: "no_observations",
  muscle_load_data_unavailable: "source_unavailable",
  current_context_unavailable: "source_unavailable",
  training_rhythm_data_unavailable: "source_unavailable",
  personalization_consent_required: "personalization_restricted",
  personalization_consent_unavailable: "personalization_restricted",
} satisfies Record<
  DigitalAthleteDataGap,
  "source_unavailable" | "no_observations" | "personalization_restricted"
>;

/**
 * Empty but readable sources are valid history, including a new athlete's
 * first snapshot. Unreadable or consent-filtered state is not canonical history
 * and must not unlock a persisted Today decision.
 */
export function canPersistDigitalAthleteState(state: DigitalAthleteState): boolean {
  return state.dataGaps.every((gap) => DATA_GAP_KIND[gap] === "no_observations");
}

function toPublicSnapshot(snapshot: AthleteStateSnapshot) {
  return {
    id: snapshot.id,
    schemaVersion: snapshot.schema_version,
    computedAt: snapshot.computed_at,
  };
}

/**
 * Computes the current deterministic athlete model from RLS-scoped facts and,
 * when every source query succeeded, stores one immutable history point via
 * the server-only service-role client. AI providers never write this state.
 */
export async function refreshAthleteStateSnapshot(
  supabase: SupabaseClient<Database>,
  userId: string,
  timeZone = "UTC",
  now = new Date(),
): Promise<AthleteModelResponse> {
  const state = await loadDigitalAthleteState(supabase, userId, now, timeZone);
  const evaluatedAt = now.toISOString();

  if (!canPersistDigitalAthleteState(state)) {
    return { state, evaluatedAt, snapshot: null };
  }

  const stateFingerprint = fingerprintDigitalAthleteState(state);
  const window = sourceWindow(now);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error: writeError } = await supabaseAdmin.from("athlete_state_snapshots").upsert(
    {
      user_id: userId,
      schema_version: state.schemaVersion,
      state: toJson(state),
      state_fingerprint: stateFingerprint,
      calculation_version: DIGITAL_ATHLETE_CALCULATION_VERSION,
      source_window_start: window.start,
      source_window_end: window.end,
      provenance_summary: toJson(provenanceSummary(state)),
      uncertainty_summary: toJson(uncertaintySummary(state)),
    },
    { onConflict: "user_id,state_fingerprint", ignoreDuplicates: true },
  );
  if (writeError) throw new Error("Could not store the athlete state snapshot.");

  const { data: storedSnapshot, error: readError } = await supabaseAdmin
    .from("athlete_state_snapshots")
    .select("id, schema_version, state, state_fingerprint, computed_at")
    .eq("user_id", userId)
    .eq("state_fingerprint", stateFingerprint)
    .maybeSingle();
  if (readError || !storedSnapshot) throw new Error("Could not read the athlete state snapshot.");

  const parsedSnapshot = AthleteStateSnapshotSchema.safeParse(storedSnapshot);
  if (!parsedSnapshot.success) throw new Error("Stored athlete state snapshot is invalid.");

  const snapshot = toPublicSnapshot(parsedSnapshot.data);
  try {
    const { reconcileCalculatedUserMemory } = await import("./deterministic-memory.service");
    await reconcileCalculatedUserMemory(userId, state, snapshot);
  } catch {
    const { recordObservabilityEvent } = await import("./observability.server");
    await recordObservabilityEvent({
      eventName: "user_memory.reconcile",
      outcome: "failure",
      userId,
      errorCode: "USER_MEMORY_RECONCILE_FAILED",
      metadata: { schema_version: snapshot.schemaVersion },
    });
  }

  return { state, evaluatedAt, snapshot };
}
