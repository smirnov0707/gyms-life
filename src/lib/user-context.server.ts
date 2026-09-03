import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { canonicalWorkoutEquipment } from "./workout-equipment.schema";
import { buildDigitalAthleteState, loadDigitalAthleteState } from "./digital-athlete.service";
import type {
  AiPersonalizationSources,
  DigitalAthleteDataGap,
  DigitalAthleteState,
} from "./digital-athlete.schema";

export type { AiPersonalizationSources } from "./digital-athlete.schema";

const GoalSchema = z.enum(["muscle_gain", "fat_loss", "recomp", "strength"]);
const ExperienceSchema = z.enum(["beginner", "intermediate", "advanced"]);
const LocaleSchema = z
  .string()
  .trim()
  .regex(/^[a-z]{2}(?:-[A-Z]{2})?$/);
const NonNegativeNumberSchema = z.number().finite().min(0);
const TimestampSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => Number.isFinite(Date.parse(value)), "Expected a valid timestamp.");

const ProfileSourceSchema = z
  .object({
    locale: z.string(),
    goal: z.string().nullable(),
    experience: z.string().nullable(),
    days_per_week: z.number().finite().int().min(1).max(7).nullable(),
    session_minutes: z.number().finite().int().min(10).max(180).nullable(),
    equipment: z.array(z.string().trim().min(1).max(80)).max(40),
  })
  .strict();

const NutritionLogSourceSchema = z
  .object({
    calories: NonNegativeNumberSchema.max(20_000),
    protein: NonNegativeNumberSchema.max(2_000),
    carbs: NonNegativeNumberSchema.max(3_000),
    fat: NonNegativeNumberSchema.max(2_000),
  })
  .strict();

const MealTargetSourceSchema = z
  .object({
    kcal_target: NonNegativeNumberSchema.max(20_000).nullable(),
    protein_target: NonNegativeNumberSchema.max(2_000).nullable(),
  })
  .strict();

const CompletedSessionSourceSchema = z
  .object({
    id: z.string().uuid(),
    finished_at: TimestampSchema,
  })
  .strict();

const CompletedSetSourceSchema = z
  .object({
    done: z.boolean(),
    rpe: z.number().finite().min(0).max(10).nullable(),
  })
  .strict();

const PersonalizationConsentSourceSchema = z
  .object({
    granted: z.boolean(),
    policy_version: z.string().trim().min(1).max(80),
    recorded_at: TimestampSchema,
  })
  .strict();

export const AiProfilePreferencesSchema = z
  .object({
    locale: LocaleSchema,
    goal: GoalSchema.nullable(),
    experience: ExperienceSchema.nullable(),
    daysPerWeek: z.number().int().min(1).max(7).nullable(),
    sessionMinutes: z.number().int().min(10).max(180).nullable(),
    equipment: z.array(z.string()).max(12),
  })
  .strict();

export type AiProfilePreferences = z.infer<typeof AiProfilePreferencesSchema>;

const TodayNutritionSchema = z
  .object({
    available: z.boolean(),
    calories: NonNegativeNumberSchema.nullable(),
    proteinG: NonNegativeNumberSchema.nullable(),
    carbsG: NonNegativeNumberSchema.nullable(),
    fatG: NonNegativeNumberSchema.nullable(),
    targetCalories: NonNegativeNumberSchema.nullable(),
    targetProteinG: NonNegativeNumberSchema.nullable(),
    remainingCalories: NonNegativeNumberSchema.nullable(),
    remainingProteinG: NonNegativeNumberSchema.nullable(),
  })
  .strict();

const RecentSessionSchema = z
  .object({
    totalSets: z.number().int().nonnegative(),
    averageRpe: z.number().finite().min(0).max(10),
    fatigueLevel: z.enum(["low", "medium", "high"]),
  })
  .strict();

export const CurrentDayContextSchema = z
  .object({
    nutrition: TodayNutritionSchema,
    recentSession: RecentSessionSchema.nullable(),
    dataGaps: z
      .array(
        z.enum([
          "today_nutrition_unavailable",
          "nutrition_targets_unavailable",
          "recent_session_unavailable",
        ]),
      )
      .max(3),
  })
  .strict();

export type CurrentDayContext = z.infer<typeof CurrentDayContextSchema>;

export const AiPersonalizationConsentSchema = z
  .object({
    enabled: z.boolean(),
    policyVersion: z.string().trim().min(1).max(80).nullable(),
    lastRecordedAt: TimestampSchema.nullable(),
  })
  .strict();

export type AiPersonalizationConsent = z.infer<typeof AiPersonalizationConsentSchema>;

export interface CentralUserContext {
  profile: AiProfilePreferences;
  currentDay: CurrentDayContext;
  aiPersonalization: AiPersonalizationConsent;
  digitalAthlete: DigitalAthleteState;
  /** Context-only gaps; athlete-model gaps stay on `digitalAthlete.dataGaps`. */
  dataGaps: string[];
}

/** Maintains a small compatibility adapter for aggregate-only callers. */
export type AiPersonalizationSummary = Pick<
  DigitalAthleteState,
  "training" | "recovery" | "body"
> & { dataGaps: DigitalAthleteDataGap[] };

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return roundToOneDecimal(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function canonicalGoal(value: string | null): AiProfilePreferences["goal"] {
  const normalized =
    value
      ?.trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_") ?? "";
  const aliases: Record<string, AiProfilePreferences["goal"]> = {
    build_muscle: "muscle_gain",
    muscle: "muscle_gain",
    muscle_gain: "muscle_gain",
    lose: "fat_loss",
    weight_loss: "fat_loss",
    fat_loss: "fat_loss",
    recomp: "recomp",
    strength: "strength",
  };
  return aliases[normalized] ?? null;
}

function canonicalExperience(value: string | null): AiProfilePreferences["experience"] {
  const parsed = ExperienceSchema.safeParse(value?.trim().toLowerCase());
  return parsed.success ? parsed.data : null;
}

function defaultProfilePreferences(): AiProfilePreferences {
  return AiProfilePreferencesSchema.parse({
    locale: "lt",
    goal: null,
    experience: null,
    daysPerWeek: null,
    sessionMinutes: null,
    equipment: [],
  });
}

/** Converts a legacy profile row into a small, canonical, non-sensitive preference contract. */
export function parseAiProfilePreferences(value: unknown): AiProfilePreferences | null {
  const parsed = ProfileSourceSchema.safeParse(value);
  if (!parsed.success) return null;

  const locale = LocaleSchema.safeParse(parsed.data.locale.trim());
  const equipment = [
    ...new Set(
      parsed.data.equipment.flatMap((item) => {
        const canonical = canonicalWorkoutEquipment(item);
        return canonical === null ? [] : [canonical];
      }),
    ),
  ];

  return AiProfilePreferencesSchema.parse({
    locale: locale.success ? locale.data : "lt",
    goal: canonicalGoal(parsed.data.goal),
    experience: canonicalExperience(parsed.data.experience),
    daysPerWeek: parsed.data.days_per_week,
    sessionMinutes: parsed.data.session_minutes,
    equipment,
  });
}

function emptyDigitalAthleteState(): DigitalAthleteState {
  return buildDigitalAthleteState({
    workouts: [],
    checkins: [],
    bodyMetrics: [],
    nutritionLogs: [],
    lifeContexts: [],
    availability: { training: true, recovery: true, body: true, nutrition: true, context: true },
  });
}

function emptyCurrentDayContext(dataGaps: CurrentDayContext["dataGaps"]): CurrentDayContext {
  return CurrentDayContextSchema.parse({
    nutrition: {
      available: false,
      calories: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
      targetCalories: null,
      targetProteinG: null,
      remainingCalories: null,
      remainingProteinG: null,
    },
    recentSession: null,
    dataGaps,
  });
}

function currentDayGapList(
  nutritionAvailable: boolean,
  targetsAvailable: boolean,
  recentSessionAvailable: boolean,
): CurrentDayContext["dataGaps"] {
  return [
    ...(nutritionAvailable ? [] : (["today_nutrition_unavailable"] as const)),
    ...(targetsAvailable ? [] : (["nutrition_targets_unavailable"] as const)),
    ...(recentSessionAvailable ? [] : (["recent_session_unavailable"] as const)),
  ];
}

/**
 * Builds current-day facts once, with bounded source schemas. It has no
 * default calorie/protein targets: an absent active meal plan is a real gap,
 * not a reason to invent numbers for an AI prompt.
 */
export async function loadCurrentDayContext(
  supabase: SupabaseClient<Database>,
  userId: string,
  now = new Date(),
): Promise<CurrentDayContext> {
  const today = now.toISOString().slice(0, 10);
  const [nutritionResult, mealTargetResult, sessionResult] = await Promise.all([
    supabase
      .from("nutrition_logs")
      .select("calories, protein, carbs, fat")
      .eq("user_id", userId)
      .eq("logged_on", today),
    supabase
      .from("meal_plans")
      .select("kcal_target, protein_target")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("workout_sessions")
      .select("id, finished_at")
      .eq("user_id", userId)
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const nutritionParsed = z.array(NutritionLogSourceSchema).safeParse(nutritionResult.data ?? []);
  const nutritionAvailable = nutritionResult.error === null && nutritionParsed.success;
  const mealTargetParsed = MealTargetSourceSchema.safeParse(mealTargetResult.data);
  const targetsAvailable = mealTargetResult.error === null && mealTargetParsed.success;
  const sessionParsed = CompletedSessionSourceSchema.safeParse(sessionResult.data);
  const sessionAvailable = sessionResult.error === null && sessionParsed.success;

  if (!nutritionAvailable) {
    return emptyCurrentDayContext(currentDayGapList(false, targetsAvailable, sessionAvailable));
  }

  const nutrition = nutritionParsed.data.reduce(
    (sum, row) => ({
      calories: sum.calories + row.calories,
      proteinG: sum.proteinG + row.protein,
      carbsG: sum.carbsG + row.carbs,
      fatG: sum.fatG + row.fat,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
  const targetCalories = targetsAvailable ? mealTargetParsed.data.kcal_target : null;
  const targetProteinG = targetsAvailable ? mealTargetParsed.data.protein_target : null;

  let recentSession: CurrentDayContext["recentSession"] = null;
  let recentSessionAvailable = sessionAvailable;
  if (sessionAvailable) {
    const setsResult = await supabase
      .from("set_logs")
      .select("done, rpe")
      .eq("user_id", userId)
      .eq("session_id", sessionParsed.data.id);
    const parsedSets = z.array(CompletedSetSourceSchema).safeParse(setsResult.data ?? []);
    recentSessionAvailable = setsResult.error === null && parsedSets.success;
    if (setsResult.error === null && parsedSets.success) {
      const completedSets = parsedSets.data.filter((set) => set.done);
      const rpes = completedSets.flatMap((set) => (set.rpe === null ? [] : [set.rpe]));
      const averageRpe = average(rpes) ?? 0;
      recentSession = RecentSessionSchema.parse({
        totalSets: completedSets.length,
        averageRpe,
        fatigueLevel: averageRpe > 8.5 ? "high" : averageRpe > 7 ? "medium" : "low",
      });
    }
  }

  return CurrentDayContextSchema.parse({
    nutrition: {
      available: true,
      ...nutrition,
      targetCalories,
      targetProteinG,
      remainingCalories:
        targetCalories === null ? null : Math.max(0, targetCalories - nutrition.calories),
      remainingProteinG:
        targetProteinG === null ? null : Math.max(0, targetProteinG - nutrition.proteinG),
    },
    recentSession,
    dataGaps: currentDayGapList(true, targetsAvailable, recentSessionAvailable),
  });
}

/**
 * Compatibility adapter for aggregate-only code. New AI callers use the
 * canonical Digital Athlete state directly instead of retaining another copy.
 */
export function buildAiPersonalizationSummary(
  sources: AiPersonalizationSources,
  now = new Date(),
): AiPersonalizationSummary {
  const state = buildDigitalAthleteState(
    {
      ...sources,
      nutritionLogs: [],
      lifeContexts: [],
      availability: { ...sources.availability, nutrition: true, context: true },
    },
    now,
  );
  return {
    training: state.training,
    recovery: state.recovery,
    body: state.body,
    dataGaps: state.dataGaps.filter(
      (gap): gap is DigitalAthleteDataGap =>
        gap !== "nutrition_data_unavailable" && gap !== "no_nutrition_logs_14d",
    ),
  };
}

function consentFrom(value: unknown, querySucceeded: boolean): AiPersonalizationConsent {
  const parsed = PersonalizationConsentSourceSchema.safeParse(value);
  return AiPersonalizationConsentSchema.parse({
    enabled: querySucceeded && parsed.success && parsed.data.granted,
    policyVersion: parsed.success ? parsed.data.policy_version : null,
    lastRecordedAt: parsed.success ? parsed.data.recorded_at : null,
  });
}

/** Builds the one permission-aware data contract allowed beyond GYMS.LIFE. */
export async function buildUserContext(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<CentralUserContext> {
  const [{ data: rawProfile, error: profileError }, consentResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("locale, goal, experience, days_per_week, session_minutes, equipment")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("ai_personalization_consents")
      .select("granted, policy_version, recorded_at")
      .eq("user_id", userId)
      .order("recorded_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const profile = profileError === null ? parseAiProfilePreferences(rawProfile) : null;
  const aiPersonalization = consentFrom(consentResult.data, consentResult.error === null);
  const currentDay = await loadCurrentDayContext(supabase, userId);
  const consentGap = consentResult.error
    ? "personalization_consent_unavailable"
    : aiPersonalization.enabled
      ? null
      : "personalization_consent_required";
  const digitalAthlete = aiPersonalization.enabled
    ? await loadDigitalAthleteState(supabase, userId)
    : emptyDigitalAthleteState();

  return {
    profile: profile ?? defaultProfilePreferences(),
    currentDay,
    aiPersonalization,
    digitalAthlete,
    dataGaps: [
      ...(profile === null ? ["profile_data_unavailable"] : []),
      ...currentDay.dataGaps,
      ...(consentGap === null ? [] : [consentGap]),
    ],
  };
}

/** Removes names, free text, dates, IDs, raw rows, and unconsented history before AI routing. */
export function contextForAi(context: CentralUserContext): string {
  const baseContext = {
    schemaVersion: "1.1",
    preferences: context.profile,
    personalization: {
      enabled: context.aiPersonalization.enabled,
      policyVersion: context.aiPersonalization.policyVersion,
    },
    dataGaps: context.aiPersonalization.enabled
      ? [...context.digitalAthlete.dataGaps, ...context.dataGaps]
      : context.dataGaps.filter(
          (gap) =>
            gap === "profile_data_unavailable" ||
            gap === "personalization_consent_required" ||
            gap === "personalization_consent_unavailable",
        ),
  };

  if (!context.aiPersonalization.enabled) {
    return JSON.stringify(baseContext, null, 2);
  }

  const nutrition = context.currentDay.nutrition;
  const nutritionToday = nutrition.available
    ? {
        calories: nutrition.calories,
        proteinG: nutrition.proteinG,
        carbsG: nutrition.carbsG,
        fatG: nutrition.fatG,
        ...(nutrition.targetCalories === null
          ? {}
          : {
              targetCalories: nutrition.targetCalories,
              remainingCalories: nutrition.remainingCalories,
            }),
        ...(nutrition.targetProteinG === null
          ? {}
          : {
              targetProteinG: nutrition.targetProteinG,
              remainingProteinG: nutrition.remainingProteinG,
            }),
      }
    : null;

  const currentContext = {
    active: context.digitalAthlete.currentContext.active.map(({ context: item }) => {
      if (item.kind === "time_limited") return { kind: item.kind, minutes: item.minutes };
      if (item.kind === "equipment_limited") {
        return { kind: item.kind, equipmentCount: item.equipment.length };
      }
      return { kind: item.kind };
    }),
    shortestAvailableSessionMinutes:
      context.digitalAthlete.currentContext.shortestAvailableSessionMinutes,
    hasTrainingConstraint: context.digitalAthlete.currentContext.hasTrainingConstraint,
    hasSafetyConstraint: context.digitalAthlete.currentContext.hasSafetyConstraint,
  };

  return JSON.stringify(
    {
      ...baseContext,
      ...(nutritionToday === null ? {} : { nutritionToday }),
      ...(context.currentDay.recentSession === null
        ? {}
        : {
            recentSession: {
              totalSets: context.currentDay.recentSession.totalSets,
              averageRpe: roundToOneDecimal(context.currentDay.recentSession.averageRpe),
              fatigueLevel: context.currentDay.recentSession.fatigueLevel,
            },
          }),
      athleteModel: {
        schemaVersion: context.digitalAthlete.schemaVersion,
        dataQuality: context.digitalAthlete.dataQuality,
        training: context.digitalAthlete.training,
        recovery: context.digitalAthlete.recovery,
        body: context.digitalAthlete.body,
        nutrition: context.digitalAthlete.nutrition,
        currentContext,
      },
    },
    null,
    2,
  );
}

export function calculateWorkoutStreak(workoutDates: string[]): number {
  const activeDates = new Set(workoutDates.map((date) => date.slice(0, 10)));
  const cursor = new Date();
  let streak = 0;

  while (true) {
    const date = cursor.toISOString().slice(0, 10);
    if (!activeDates.has(date)) {
      if (streak === 0) {
        cursor.setUTCDate(cursor.getUTCDate() - 1);
        if (!activeDates.has(cursor.toISOString().slice(0, 10))) return 0;
        continue;
      }
      return streak;
    }
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
}
