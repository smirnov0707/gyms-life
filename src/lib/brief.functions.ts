import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { LANGUAGE_NAMES, SupportedLanguageSchema } from "./language.schema";
import { IanaTimeZoneSchema, dayInTimeZone } from "./local-day";

/** Vieninteliai maršrutai, į kuriuos AI gali nukreipti veiksmų kortelėse. */
export const BRIEF_ROUTES = [
  "/app",
  "/onboarding",
  "/exercises",
  "/ar",
  "/meal-plan",
  "/nutrition",
  "/supplements",
  "/progress",
  "/readiness",
  "/coach",
  "/achievements",
  "/reminders",
] as const;

export type BriefRoute = (typeof BRIEF_ROUTES)[number];

const ActionSchema = z.object({
  title: z.string(),
  reason: z.string(),
  evidence: z.string().default(""),
  route: z.string(),
  cta: z.string(),
  priority: z.preprocess(
    (v) => (typeof v === "string" ? v.toLowerCase() : v),
    z.enum(["high", "medium", "low"]).catch("medium"),
  ),
});

const SignalSchema = z.object({
  label: z.string(),
  value: z.string(),
  note: z.string().default(""),
  tone: z.preprocess(
    (v) => (typeof v === "string" ? v.toLowerCase() : v),
    z.enum(["good", "neutral", "risk"]).catch("neutral"),
  ),
});

const BriefSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  focus: z.string(),
  signals: z.array(SignalSchema).default([]),
  actions: z.array(ActionSchema).default([]),
  watchouts: z.array(z.string()).default([]),
});

export type BriefSignal = {
  label: string;
  value: string;
  note: string;
  tone: "good" | "neutral" | "risk";
};
export type BriefAction = {
  title: string;
  reason: string;
  evidence: string;
  route: BriefRoute;
  cta: string;
  priority: "high" | "medium" | "low";
};

export const DailyBriefSchema = BriefSchema.extend({
  actions: z.array(ActionSchema.extend({ route: z.enum(BRIEF_ROUTES) })).max(4),
  gaps: z.array(z.string()).max(10),
  streakDays: z.number().int().min(0),
  readiness: z.number().finite().min(0).max(100).nullable(),
});

export type DailyBrief = z.infer<typeof DailyBriefSchema>;

function isBriefRoute(route: string): route is BriefRoute {
  return BRIEF_ROUTES.some((allowedRoute) => allowedRoute === route);
}

export const getDailyBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        lang: SupportedLanguageSchema.default("lt"),
        timeZone: IanaTimeZoneSchema.optional(),
      })
      .strict()
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<DailyBrief> => {
    const { supabase, userId } = context;

    const { buildUserContext, loadPersistedProfileTimeZone } =
      await import("./user-context.server");
    const timeZone = data.timeZone ?? (await loadPersistedProfileTimeZone(supabase, userId));
    const snapshot = await buildUserContext(supabase, userId, timeZone);

    const { generateOrchestratedJson } = await import("./ai-orchestrator.server");

    const language = LANGUAGE_NAMES[data.lang];
    const personalizationRules = snapshot.aiPersonalization.enabled
      ? "Personalization consent is enabled. Use the aggregate training, recovery, body, and nutrition context exactly as provided."
      : "Personalization consent is disabled. The snapshot deliberately omits nutrition, training history, recovery, and body-trend data. Do not infer or invent these data. Briefly explain that detailed recommendations require the user to enable AI personalization in /coach, and include one /coach action for that purpose.";

    const system = `You are the operating brain of GYMS.LIFE, a training + nutrition app. You receive only the permission-aware snapshot below and your job is to connect the dots between the app's features and tell the user exactly what to do today.

APP FEATURES YOU CAN SEND THE USER TO (use the exact route string):
- "/app" — dashboard, today's workout, start session
- "/onboarding" — body scan + goal intake, generates a new training plan
- "/exercises" — exercise library with technique videos and AI filters
- "/ar" — live technique scanner / form check with camera
- "/meal-plan" — AI meal plan, shopping list, TDEE, fasting window
- "/nutrition" — food diary, meal photo scanner, menu scanner, fridge scanner
- "/supplements" — supplement stack, label scanner, cycling advisor, deficiency check
- "/progress" — charts, body metrics, body composition scan, forecast, injury risk
- "/readiness" — daily readiness check-in that auto-adjusts today's load
- "/coach" — AI coach chat
- "/achievements" — streaks and badges
- "/reminders" — notification schedule

RULES
- Write EVERYTHING in ${language}.
- headline: max 6 words, punchy, specific to this person today.
- summary: 2-3 sentences connecting their training, recovery and nutrition state. When personalization is enabled, quote at least three concrete numbers from the snapshot (kcal, kg, streak days, readiness score, sleep hours, days since last workout). When it is disabled, never invent those numbers; describe the consent gap instead.
- signals: When personalization is enabled, return 3-5 data citations taken VERBATIM from the snapshot. When it is disabled, return 1-2 consent/data-gap signals only. label = what the metric is (2-3 words), value = the exact number/date with unit as it appears in the snapshot, note = max 12 words explaining why that number matters today. tone = "good" | "neutral" | "risk". Never invent a number that is not in the snapshot; if data is missing, cite the gap (value = "—") and say what to log.
- focus: 2-4 words, the single theme of the day.
- actions: 3 or 4 items, ordered by importance. Each must reference REAL data from the snapshot and point to the most relevant route. Never recommend something already done today. Fill the biggest gaps first (see MISSING DATA FLAGS). reason = max 14 words, concrete. evidence = the exact data point from the snapshot that triggered this action, formatted like "readiness 62 / sleep 5.5h" or "0 kcal logged today" — numbers only from the snapshot, max 8 words. cta = 2-3 word button label.
- watchouts: 0-2 short warnings (fatigue, missed protein, long inactivity, low form score). Empty array if nothing to warn about.
- No medical claims. No generic motivational filler.

PERSONALIZATION RULES
${personalizationRules}

USER SNAPSHOT
The permission-aware GYMS.LIFE central user context is appended after these instructions. Treat it as the only source of user facts.

RETURN EXACTLY THIS JSON SHAPE:
{"headline":"string","summary":"string","focus":"string","signals":[{"label":"string","value":"string","note":"string","tone":"good"}],"actions":[{"title":"string","reason":"string","evidence":"string","route":"/readiness","cta":"string","priority":"high"}],"watchouts":["string"]}`;

    let parsed: z.infer<typeof BriefSchema>;
    try {
      parsed = await generateOrchestratedJson({
        task: "daily-brief",
        supabase,
        userId,
        centralUserContext: snapshot,
        system,
        prompt: "Generate today's brief.",
        schema: BriefSchema,
        maxOutputTokens: 2600,
      });
    } catch (error) {
      console.error("getDailyBrief failed", error);
      const message = error instanceof Error ? error.message : "";
      if (message === "AI_CREDITS" || message === "AI_RATE_LIMIT") throw new Error(message);
      throw new Error("Could not build today's brief. Try again.");
    }

    const actions = parsed.actions
      .flatMap((action) => (isBriefRoute(action.route) ? [{ ...action, route: action.route }] : []))
      .slice(0, 4);

    const [{ data: recentWorkouts }, { data: latestCheckin }] = await Promise.all([
      supabase
        .from("workout_sessions")
        .select("started_at")
        .eq("user_id", userId)
        .not("finished_at", "is", null)
        .order("started_at", { ascending: false })
        .limit(90),
      supabase
        .from("daily_checkins")
        .select("checkin_on, readiness_score")
        .eq("user_id", userId)
        .order("checkin_on", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const today = dayInTimeZone(new Date(), timeZone);
    const workoutDates = (recentWorkouts ?? []).map((workout) => workout.started_at);
    const { calculateWorkoutStreak } = await import("./user-context.server");
    const gaps = [
      ...(latestCheckin?.checkin_on === today ? [] : ["daily_readiness_checkin"]),
      ...(snapshot.currentDay.nutrition.available &&
      snapshot.currentDay.nutrition.calories !== null &&
      snapshot.currentDay.nutrition.calories > 0
        ? []
        : ["nutrition_logged_today"]),
      ...(workoutDates.some((date) => Date.now() - new Date(date).getTime() <= 7 * 86_400_000)
        ? []
        : ["workout_last_7_days"]),
    ];

    return DailyBriefSchema.parse({
      headline: parsed.headline,
      summary: parsed.summary,
      focus: parsed.focus,
      signals: parsed.signals.slice(0, 5),
      actions,
      watchouts: parsed.watchouts.slice(0, 2),
      gaps,
      streakDays: calculateWorkoutStreak(workoutDates, timeZone),
      readiness: latestCheckin?.readiness_score ?? null,
    });
  });
