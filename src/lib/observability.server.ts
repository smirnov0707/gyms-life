import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ObservabilityEventNameSchema = z.enum([
  "ai.request",
  "ai.voice_transcription",
  "meal_plan.activation",
  "meal_plan.generation",
  "life_context.dismiss",
  "life_context.set",
  "today_decision.outcome",
  "training_plan.activation",
  "training_plan.generation",
  "user_memory.correct",
  "user_memory.forget",
  "user_memory.mark_incorrect",
  "user_memory.reconcile",
]);

const SafeMetadataValueSchema = z.union([
  z.boolean(),
  z.number().finite(),
  z.string().trim().min(1).max(120),
]);

const SafeMetadataSchema = z
  .record(z.string().regex(/^[a-z][a-z0-9_]{0,63}$/), SafeMetadataValueSchema)
  .refine((metadata) => Object.keys(metadata).length <= 8, {
    message: "Observability metadata is limited to eight scalar values.",
  });

export const ObservabilityEventInputSchema = z
  .object({
    eventName: ObservabilityEventNameSchema,
    outcome: z.enum(["success", "failure"]),
    userId: z.string().uuid(),
    durationMs: z.number().int().min(0).max(86_400_000).optional(),
    errorCode: z
      .string()
      .regex(/^[A-Z][A-Z0-9_]{2,99}$/)
      .optional(),
    metadata: SafeMetadataSchema.default({}),
  })
  .strict();

type ObservabilityEventInput = z.input<typeof ObservabilityEventInputSchema>;
type ParsedObservabilityEvent = z.output<typeof ObservabilityEventInputSchema>;

function durationSince(startedAt: number): number {
  return Math.min(Math.max(Date.now() - startedAt, 0), 86_400_000);
}

/**
 * Writes an internal event without ever affecting a user-facing request. The
 * parsed schema keeps private source data out of the operational data store.
 */
export async function recordObservabilityEvent(input: ObservabilityEventInput): Promise<void> {
  let event: ParsedObservabilityEvent | undefined;

  try {
    event = ObservabilityEventInputSchema.parse(input);
    const { error } = await supabaseAdmin.from("app_observability_events").insert({
      event_name: event.eventName,
      outcome: event.outcome,
      user_id: event.userId,
      ...(event.durationMs === undefined ? {} : { duration_ms: event.durationMs }),
      ...(event.errorCode === undefined ? {} : { error_code: event.errorCode }),
      metadata: event.metadata,
    });

    if (error) throw error;
  } catch {
    // Do not let unavailable operational telemetry block health, training, or
    // AI workflows. Do not log the original error: it may include provider or
    // database implementation details.
    console.error("[Observability] event write failed", {
      eventName: event?.eventName ?? "invalid",
      errorCode: "OBSERVABILITY_WRITE_FAILED",
    });
  }
}

/** Measures a server-owned workflow and records only its stable result code. */
export async function observeServerAction<T>(
  input: Omit<ObservabilityEventInput, "outcome" | "durationMs" | "errorCode"> & {
    failureCode: string;
  },
  action: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  const { failureCode, ...event } = input;

  try {
    const result = await action();
    await recordObservabilityEvent({
      ...event,
      outcome: "success",
      durationMs: durationSince(startedAt),
    });
    return result;
  } catch (error) {
    await recordObservabilityEvent({
      ...event,
      outcome: "failure",
      durationMs: durationSince(startedAt),
      errorCode: failureCode,
    });
    throw error;
  }
}
