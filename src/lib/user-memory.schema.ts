import { z } from "zod";
import { CalculatedMemoryValueSchema } from "./calculated-memory.contract";
import { MemoryEvidenceStateSchema, type MemoryEvidenceState } from "./memory-evidence.schema";

const TimestampSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => Number.isFinite(Date.parse(value)), "Expected a valid timestamp.");

export const UserMemoryTypeSchema = z.enum([
  "preference",
  "goal",
  "constraint",
  "pattern",
  "fact",
  "coaching",
  "nutrition",
  "training",
  "recovery",
  "behavior",
  "training_pattern",
  "recovery_pattern",
  "nutrition_pattern",
  "coaching_insight",
  "discovery",
  "current_context",
]);

export type UserMemoryType = z.infer<typeof UserMemoryTypeSchema>;

export const UserMemorySourceSchema = z.enum([
  "user_reported",
  "measured",
  "wearable",
  "calculated",
  "ai_inferred",
  "experimental",
  "system_generated",
]);

export type UserMemorySource = z.infer<typeof UserMemorySourceSchema>;

export const UserMemoryStatusSchema = z.enum([
  "active",
  "superseded",
  "expired",
  "dismissed",
  "corrected",
  "incorrect",
]);

function evidenceStateForMemory(
  source: UserMemorySource,
  calculatedValue: z.infer<typeof CalculatedMemoryValueSchema> | null,
): MemoryEvidenceState {
  if (source === "user_reported") return "user_confirmed";
  if (source === "measured" || source === "wearable") return "measured_record";
  if (source === "calculated") {
    return calculatedValue === null ? "requires_review" : "calculated_threshold_met";
  }
  if (source === "ai_inferred") return "hypothesis_needs_confirmation";
  if (source === "experimental") return "experiment_in_progress";
  return "system_record";
}

const UserMemoryDbRowSchema = z
  .object({
    id: z.string().uuid(),
    memory_type: UserMemoryTypeSchema,
    content: z.string().trim().min(1).max(400),
    source: UserMemorySourceSchema,
    // Legacy raw database field. The domain model derives an evidence state
    // from provenance plus validated evidence instead of exposing this as a probability.
    confidence: z.number().finite().min(0).max(1),
    importance: z.number().finite().min(0).max(1),
    status: UserMemoryStatusSchema,
    value: z.unknown().nullable().default(null),
    evidence_refs: z.array(z.unknown()),
    last_confirmed_at: TimestampSchema,
    expires_at: TimestampSchema.nullable(),
  })
  .strict();

export const UserMemoryTransparencyItemResultSchema = z
  .object({
    id: z.string().uuid(),
    type: UserMemoryTypeSchema,
    content: z.string().trim().min(1).max(400),
    source: UserMemorySourceSchema,
    evidenceState: MemoryEvidenceStateSchema,
    importance: z.number().finite().min(0).max(1),
    status: UserMemoryStatusSchema,
    calculatedValue: CalculatedMemoryValueSchema.nullable(),
    evidenceCount: z.number().int().nonnegative(),
    lastConfirmedAt: TimestampSchema,
    expiresAt: TimestampSchema.nullable(),
  })
  .strict();

export const UserMemoryTransparencyItemSchema = UserMemoryDbRowSchema.transform((row) => {
  const calculatedValue =
    row.source === "calculated" ? CalculatedMemoryValueSchema.safeParse(row.value) : null;

  return UserMemoryTransparencyItemResultSchema.parse({
    id: row.id,
    type: row.memory_type,
    content: row.content,
    source: row.source,
    evidenceState: evidenceStateForMemory(
      row.source,
      calculatedValue?.success ? calculatedValue.data : null,
    ),
    importance: row.importance,
    status: row.status,
    calculatedValue: calculatedValue?.success ? calculatedValue.data : null,
    evidenceCount: row.evidence_refs.length,
    lastConfirmedAt: row.last_confirmed_at,
    expiresAt: row.expires_at,
  });
});

export type UserMemoryTransparencyItem = z.infer<typeof UserMemoryTransparencyItemSchema>;

type CalculatedMemoryTransparencyFields = Pick<
  UserMemoryTransparencyItem,
  "source" | "calculatedValue"
>;

/** Returns only an application-owned calculated value that matches a known contract. */
export function calculatedMemoryValueForTransparency(
  memory: CalculatedMemoryTransparencyFields,
): UserMemoryTransparencyItem["calculatedValue"] {
  return memory.source === "calculated" ? memory.calculatedValue : null;
}

/** Bounded active memory that may reach an AI worker after explicit consent. */
export const ActiveMemoryForAiItemSchema = z
  .object({
    type: UserMemoryTypeSchema.exclude(["current_context"]),
    content: z.string().trim().min(1).max(400),
    source: UserMemorySourceSchema,
    evidenceState: MemoryEvidenceStateSchema,
    importance: z.number().finite().min(0).max(1),
  })
  .strict();

export const ActiveMemoryForAiSchema = z
  .object({
    available: z.boolean(),
    entries: z.array(ActiveMemoryForAiItemSchema).max(12),
  })
  .strict();

export type ActiveMemoryForAi = z.infer<typeof ActiveMemoryForAiSchema>;

/** Removes IDs, dates, evidence references, and temporary context before AI routing. */
export function buildActiveMemoryForAi(value: unknown): ActiveMemoryForAi {
  const entries = parseUserMemoryTransparencyItems(value)
    .filter(
      (item) =>
        item.status === "active" &&
        item.type !== "current_context" &&
        item.evidenceState !== "requires_review",
    )
    .slice(0, 12)
    .map((item) => ({
      type: item.type,
      content: item.content,
      source: item.source,
      evidenceState: item.evidenceState,
      importance: item.importance,
    }));
  return ActiveMemoryForAiSchema.parse({ available: true, entries });
}

/** A user correction becomes a new, explicitly user-reported memory record. */
export const CorrectUserMemoryInputSchema = z
  .object({
    memoryId: z.string().uuid(),
    content: z.string().trim().min(1).max(400),
  })
  .strict();

export type CorrectUserMemoryInput = z.infer<typeof CorrectUserMemoryInputSchema>;

/** Validates raw Supabase rows before rendering user-owned intelligence. */
export function parseUserMemoryTransparencyItems(value: unknown): UserMemoryTransparencyItem[] {
  return z.array(UserMemoryTransparencyItemSchema).parse(value ?? []);
}
