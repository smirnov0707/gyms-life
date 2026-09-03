import { z } from "zod";
import { AvailableWorkoutEquipmentSchema } from "./workout-equipment.schema";

const TimestampSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => Number.isFinite(Date.parse(value)), "Expected a valid timestamp.");

const OptionalNoteSchema = z.string().trim().min(1).max(280).optional();

export const LifeContextKindSchema = z.enum([
  "travel",
  "time_limited",
  "equipment_limited",
  "facility_closed",
  "high_stress",
  "temporary_limitation",
]);

export const LifeContextValueSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("travel"), note: OptionalNoteSchema }).strict(),
  z
    .object({
      kind: z.literal("time_limited"),
      minutes: z.number().int().min(10).max(180),
      note: OptionalNoteSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("equipment_limited"),
      equipment: AvailableWorkoutEquipmentSchema,
      note: OptionalNoteSchema,
    })
    .strict(),
  z.object({ kind: z.literal("facility_closed"), note: OptionalNoteSchema }).strict(),
  z.object({ kind: z.literal("high_stress"), note: OptionalNoteSchema }).strict(),
  z.object({ kind: z.literal("temporary_limitation"), note: OptionalNoteSchema }).strict(),
]);

export type LifeContextValue = z.infer<typeof LifeContextValueSchema>;

export const LifeContextInputSchema = z
  .object({
    kind: LifeContextKindSchema,
    durationHours: z
      .number()
      .int()
      .min(1)
      .max(24 * 30),
    timeAvailableMinutes: z.number().int().min(10).max(180).optional(),
    availableEquipment: AvailableWorkoutEquipmentSchema.optional(),
    note: OptionalNoteSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.kind === "time_limited" && value.timeAvailableMinutes === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["timeAvailableMinutes"],
        message: "A time-limited context requires available minutes.",
      });
    }
    if (value.kind === "equipment_limited" && value.availableEquipment === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["availableEquipment"],
        message: "An equipment-limited context requires available equipment.",
      });
    }
  });

export type LifeContextInput = z.infer<typeof LifeContextInputSchema>;

export const ActiveLifeContextSchema = z
  .object({
    id: z.string().uuid(),
    content: z.string().trim().min(1).max(400),
    expiresAt: TimestampSchema,
    context: LifeContextValueSchema,
  })
  .strict();

export type ActiveLifeContext = z.infer<typeof ActiveLifeContextSchema>;

const LifeContextMemoryRowSchema = z
  .object({
    id: z.string().uuid(),
    content: z.string().trim().min(1).max(400),
    value: z.unknown(),
    expires_at: TimestampSchema,
  })
  .strict();

/** Validates a raw `user_memory` row before it becomes current athlete state. */
export function parseActiveLifeContext(value: unknown): ActiveLifeContext {
  const row = LifeContextMemoryRowSchema.parse(value);
  return ActiveLifeContextSchema.parse({
    id: row.id,
    content: row.content,
    expiresAt: row.expires_at,
    context: LifeContextValueSchema.parse(row.value),
  });
}

/** Keeps the structured value canonical; presentation text is derived separately. */
export function lifeContextValueFromInput(input: LifeContextInput): LifeContextValue {
  const parsed = LifeContextInputSchema.parse(input);
  const note = parsed.note === undefined ? {} : { note: parsed.note };

  if (parsed.kind === "time_limited") {
    if (parsed.timeAvailableMinutes === undefined) {
      throw new Error("A validated time-limited context is missing its time budget.");
    }
    return LifeContextValueSchema.parse({
      kind: parsed.kind,
      minutes: parsed.timeAvailableMinutes,
      ...note,
    });
  }
  if (parsed.kind === "equipment_limited") {
    if (parsed.availableEquipment === undefined) {
      throw new Error("A validated equipment-limited context is missing equipment.");
    }
    return LifeContextValueSchema.parse({
      kind: parsed.kind,
      equipment: parsed.availableEquipment,
      ...note,
    });
  }
  return LifeContextValueSchema.parse({ kind: parsed.kind, ...note });
}
