import { isAiConfigured } from "./ai-gateway.server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LANGUAGE_NAMES, SupportedLanguageSchema } from "./language.schema";
import { SupplementCategorySchema, SupplementPreferredTimeSchema } from "./supplement.schema";

const looseNum = z.coerce.number().catch(0);

const ScanInput = z.object({ lang: SupportedLanguageSchema.default("lt") });

const FindingSchema = z.object({
  name: z.string(),
  current: z.string().default(""),
  target: z.string().default(""),
  gapPercent: looseNum.default(0),
  priority: z.string().default("medium"),
  reason: z.string().default(""),
  evidence: z.string().default(""),
  foodFix: z.string().default(""),
  supplement: z
    .object({
      name: z.string().default(""),
      dose: z.string().default(""),
      category: SupplementCategorySchema.catch("vitamin"),
      times_per_day: z.coerce.number().int().min(1).max(4).catch(1),
      with_food: z.coerce.boolean().catch(true),
      preferred_time: SupplementPreferredTimeSchema.catch("morning"),
    })
    .nullable()
    .default(null),
});

const ScanSchema = z.object({
  summary: z.string().default(""),
  dataQuality: z.string().default(""),
  findings: z.array(FindingSchema).default([]),
  strengths: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
});

export const scanMicronutrients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => ScanInput.parse(input))
  .handler(async ({ data, context }) => {
    const { loadMicroSnapshot, fallbackMicroScan } = await import("./micronutrient.server");
    const snap = await loadMicroSnapshot(context.supabase, context.userId);
    if (!isAiConfigured()) return fallbackMicroScan(data.lang, snap.days);

    const { generateOrchestratedJson } = await import("./ai-orchestrator.server");
    const language = LANGUAGE_NAMES[data.lang];

    const age = snap.profile.birthYear ? new Date().getFullYear() - snap.profile.birthYear : null;

    const system = `You are a sports dietitian doing a micronutrient gap analysis. Answer entirely in ${language}.

Use ONLY the athlete data below. Estimate typical micronutrient intake from the logged foods; never invent lab values and never claim to diagnose.
Return 4-7 findings, ordered by priority (critical > high > medium > low). Cover both micronutrients that are LOW and any that are already covered by supplements (mark those low priority with gapPercent 0).
Consider double-dosing risk: if a supplement the athlete already takes covers a nutrient, say so in evidence and set supplement to null.
current/target = short human strings with units per day (e.g. "~210 mg/d" / "350-400 mg/d").
gapPercent = 0-100 estimated shortfall.
evidence = quote concrete data (e.g. "0 fish meals in 14 days", "avg 1850 kcal/day").
foodFix = concrete foods with portions.
supplement = a supplement row to add, or null when food is enough or it is already covered.
strengths = 2-3 things already good. warnings = interaction/overdose/medical cautions plus a note that this is not a diagnosis.

ATHLETE: ${snap.profile.gender}, ${age ?? "?"} y, ${snap.profile.weight === null ? "weight not recorded" : `${snap.profile.weight} kg`}, ${snap.profile.height} cm, goal ${snap.profile.goal}, diet ${snap.profile.diet}.
TRAINING: ${snap.training.sessions14d} sessions in 14 days, avg sleep ${snap.training.avgSleep} h, avg readiness ${snap.training.avgReadiness}.
NUTRITION: ${snap.days} logged days, avg ${snap.avgKcal} kcal/day, avg ${snap.avgProtein} g protein/day.
FOOD LOG: ${snap.foodEntries.map((f) => `${f.day} ${f.food} (${f.kcal}kcal P${f.protein}/C${f.carbs}/F${f.fat})`).join("; ") || "empty"}.
CURRENT SUPPLEMENTS: ${snap.supplements.map((s) => `${s.name} ${s.dose} x${s.times_per_day}`).join("; ") || "none"}.

Return exactly: {"summary":"","dataQuality":"","findings":[{"name":"","current":"","target":"","gapPercent":0,"priority":"high","reason":"","evidence":"","foodFix":"","supplement":{"name":"","dose":"","category":"vitamin","times_per_day":1,"with_food":true,"preferred_time":"morning"}}],"strengths":[""],"warnings":[""]}`;

    try {
      const r = await generateOrchestratedJson({
        task: "micronutrients",
        supabase: context.supabase,
        userId: context.userId,
        system,
        prompt: "Run the micronutrient gap analysis on this athlete's data.",
        schema: ScanSchema,
        maxOutputTokens: 4000,
      });
      if (r.findings.length === 0) return fallbackMicroScan(data.lang, snap.days);

      const allowed = ["critical", "high", "medium", "low"];
      return {
        summary: r.summary,
        dataQuality: r.dataQuality,
        loggedDays: snap.days,
        findings: r.findings.slice(0, 7).map((f, i) => ({
          key: `${i}-${f.name}`,
          name: f.name,
          current: f.current,
          target: f.target,
          gapPercent: Math.max(0, Math.min(100, Math.round(f.gapPercent))),
          priority: (allowed.includes(f.priority.toLowerCase())
            ? f.priority.toLowerCase()
            : "medium") as "critical" | "high" | "medium" | "low",
          reason: f.reason,
          evidence: f.evidence,
          foodFix: f.foodFix,
          supplement:
            f.supplement && f.supplement.name
              ? {
                  ...f.supplement,
                  times_per_day: Math.max(1, Math.round(f.supplement.times_per_day)),
                }
              : null,
        })),
        strengths: r.strengths.slice(0, 4),
        warnings: r.warnings.slice(0, 4),
        fallback: false,
      };
    } catch {
      return fallbackMicroScan(data.lang, snap.days);
    }
  });
