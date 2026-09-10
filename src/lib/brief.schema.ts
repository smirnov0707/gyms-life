import { z } from "zod";
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

export const BriefSchema = z.object({
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
