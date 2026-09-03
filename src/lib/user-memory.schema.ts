import { z } from "zod";

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

const UserMemoryDbRowSchema = z
  .object({
    id: z.string().uuid(),
    memory_type: UserMemoryTypeSchema,
    content: z.string().trim().min(1).max(400),
    source: UserMemorySourceSchema,
    confidence: z.number().finite().min(0).max(1),
    importance: z.number().finite().min(0).max(1),
    status: UserMemoryStatusSchema,
    evidence_refs: z.array(z.unknown()),
    last_confirmed_at: TimestampSchema,
    expires_at: TimestampSchema.nullable(),
  })
  .strict();

export const UserMemoryTransparencyItemSchema = UserMemoryDbRowSchema.transform((row) => ({
  id: row.id,
  type: row.memory_type,
  content: row.content,
  source: row.source,
  confidence: row.confidence,
  importance: row.importance,
  status: row.status,
  evidenceCount: row.evidence_refs.length,
  lastConfirmedAt: row.last_confirmed_at,
  expiresAt: row.expires_at,
}));

export type UserMemoryTransparencyItem = z.infer<typeof UserMemoryTransparencyItemSchema>;

/** Validates raw Supabase rows before rendering user-owned intelligence. */
export function parseUserMemoryTransparencyItems(value: unknown): UserMemoryTransparencyItem[] {
  return z.array(UserMemoryTransparencyItemSchema).parse(value ?? []);
}
