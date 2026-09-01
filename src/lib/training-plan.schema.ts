import { z } from "zod";

export const TrainingPlanExerciseSchema = z.object({
  slug: z.string(),
  name: z.string(),
  sets: z.coerce.number().int().positive(),
  reps: z.union([z.string(), z.number()]).transform(String),
  rest_seconds: z.coerce.number().int().nonnegative(),
  notes: z.string().optional().default(""),
});

export const TrainingPlanDaySchema = z.object({
  day: z.coerce.number().int().positive(),
  title: z.string(),
  focus: z.string(),
  warmup: z.string(),
  cooldown: z.string(),
  estimated_minutes: z.coerce.number().int().positive(),
  exercises: z.array(TrainingPlanExerciseSchema),
});

export const TrainingPlanDataSchema = z.object({
  title: z.string(),
  summary: z.string(),
  weeks: z.coerce.number().int().positive(),
  progression: z.string(),
  nutrition: z.string(),
  days: z.array(TrainingPlanDaySchema),
});

export type TrainingPlanExercise = z.infer<typeof TrainingPlanExerciseSchema>;
export type TrainingPlanDay = z.infer<typeof TrainingPlanDaySchema>;
export type TrainingPlanData = z.infer<typeof TrainingPlanDataSchema>;
