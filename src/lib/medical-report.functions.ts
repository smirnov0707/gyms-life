import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { ReportStats } from "./medical-report.server";

const SectionSchema = z.object({
  title: z.string(),
  body: z.string(),
  metrics: z.array(z.object({ label: z.string(), value: z.string(), note: z.string().default("") })).default([]),
});

const ReportSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  adherence: z.object({ score: z.number(), label: z.string(), note: z.string().default("") }),
  sections: z.array(SectionSchema).default([]),
  risks: z.array(z.object({ title: z.string(), detail: z.string(), severity: z.string().default("low") })).default([]),
  recommendations: z.array(z.object({ title: z.string(), detail: z.string() })).default([]),
  questionsForDoctor: z.array(z.string()).default([]),
  dataGaps: z.array(z.string()).default([]),
});

export type MedicalReport = z.infer<typeof ReportSchema> & { stats: ReportStats; generatedAt: string };

export const getMedicalReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ lang: z.enum(["lt", "en", "ru", "uk", "pl", "de", "es", "fr"]).default("lt") }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<MedicalReport> => {
    const { supabase, userId } = context;

    const { buildReportStats, statsToPrompt } = await import("./medical-report.server");
    const stats = await buildReportStats(supabase, userId);

    const { generateJson } = await import("./ai-json.server");
    const { createAiRouterProvider } = await import("./ai-gateway.server");
    const { LANG_NAMES } = await import("./plan-i18n.server");
    const gateway = createAiRouterProvider("medical-report.functions");
    const language = LANG_NAMES[data.lang] ?? "English";

    const system = `You write a 30-day training, recovery and nutrition report that the user can hand to their physician, physiotherapist or coach. Accuracy is everything.

HARD RULES
- Write everything in ${language}.
- Use ONLY numbers present in the DATA block. Never invent, round creatively, or extrapolate a metric that is not listed. If something is missing, say so and put it in dataGaps.
- No diagnosis, no medical claims, no treatment or dosage advice. Describe observed training/lifestyle data and behavioural recommendations only.
- Every metric.value must be a literal figure from DATA with its unit (e.g. "18 sessions", "62 500 kg", "6.4 h").
- adherence.score: integer 0-100 derived from training frequency vs goal, check-in count (out of 30), nutrition days logged (out of 30). label = 3 words max.
- sections: exactly 4, in this order — training load, recovery & sleep, nutrition, body composition. body = 2-4 sentences citing numbers; metrics = 3-4 entries each.
- risks: 0-3 observations worth flagging (e.g. very low logging, weight change rate, low sleep, high volume with low readiness). severity = "low" | "medium" | "high".
- recommendations: 3-5 concrete, behavioural, measurable for the next 30 days.
- questionsForDoctor: 2-4 short questions the user could ask a clinician, based only on the observed data.

DATA
${statsToPrompt(stats)}

RETURN EXACTLY THIS JSON SHAPE:
{"headline":"string","summary":"string","adherence":{"score":0,"label":"string","note":"string"},"sections":[{"title":"string","body":"string","metrics":[{"label":"string","value":"string","note":"string"}]}],"risks":[{"title":"string","detail":"string","severity":"low"}],"recommendations":[{"title":"string","detail":"string"}],"questionsForDoctor":["string"],"dataGaps":["string"]}`;

    let parsed: z.infer<typeof ReportSchema>;
    try {
      parsed = await generateJson(gateway("google/gemini-3.1-flash-lite"), {
        system,
        prompt: "Generate the 30-day report.",
        schema: ReportSchema,
        maxOutputTokens: 5000,
      });
    } catch (error) {
      console.error("getMedicalReport failed", error);
      throw new Error("Could not build the report. Try again.");
    }

    return {
      ...parsed,
      adherence: {
        ...parsed.adherence,
        score: Math.max(0, Math.min(100, Math.round(parsed.adherence.score))),
      },
      sections: parsed.sections.slice(0, 4),
      risks: parsed.risks.slice(0, 3),
      recommendations: parsed.recommendations.slice(0, 5),
      questionsForDoctor: parsed.questionsForDoctor.slice(0, 4),
      stats,
      generatedAt: new Date().toISOString(),
    };
  });
