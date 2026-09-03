import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateOrchestratedJson } from "./ai-orchestrator.server";
import { LANGUAGE_NAMES, SupportedLanguageSchema } from "./language.schema";
import { SupplementCategorySchema, SupplementPreferredTimeSchema } from "./supplement.schema";

const SupplementVisionInput = z.object({
  image: z.string().min(10),
  lang: SupportedLanguageSchema.default("lt"),
});

const SupplementProductSchema = z.object({
  name: z.string().trim().min(1).max(160),
  dose: z.string().trim().max(120).default(""),
  category: SupplementCategorySchema.default("general"),
  timesPerDay: z.coerce.number().int().min(1).max(4).default(1),
  withFood: z.boolean().default(false),
  preferredTime: SupplementPreferredTimeSchema.default("any"),
  notes: z.string().trim().max(500).default(""),
  confidence: z.coerce.number().int().min(0).max(100).default(0),
  readable: z.string().trim().max(500).default(""),
});

export const SupplementVisionResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), products: z.array(SupplementProductSchema).min(1).max(8) }),
  z.object({ ok: z.literal(false), reason: z.string().trim().min(1).max(300) }),
]);

export type SupplementVisionResult = z.infer<typeof SupplementVisionResultSchema>;

function failedSupplementScan(reason: string): SupplementVisionResult {
  return { ok: false, reason };
}

export const analyzeSupplementPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => SupplementVisionInput.parse(data))
  .handler(async ({ data, context }) => {
    try {
      const langName = LANGUAGE_NAMES[data.lang];

      const prompt = `Tu esi profesionalus sporto papildų ir farmakologijos AI ekspertas.
Išanalizuok pateiktą maisto papildo pakuotės ar sudėties etiketės nuotrauką.

Jei nuotraukoje NĖRA papildo ar etiketė neįskaitoma:
{"ok": false, "reason": "Papildo etiketė neįskaitoma. Nufotografuokite sudėties lentelę iš arčiau."}

Jei papildas atpažintas:
{
  "ok": true,
  "products": [{
    "name": "Papildo pavadinimas ir gamintojas",
    "dose": "5 g",
    "category": "creatine | protein | vitamin | mineral | iron | calcium | omega | preworkout | electrolyte | probiotic | general",
    "timesPerDay": 1,
    "withFood": false,
    "preferredTime": "any | morning | pre_workout | post_workout | evening | bedtime",
    "notes": "Trumpas saugus vartojimo kontekstas ${langName} kalba",
    "confidence": 92,
    "readable": "Etiketės tekstas arba tuščia eilutė"
  }]
}
      Atsakyk TIK TIKSLIU JSON be jokio markdown.`;

      return await generateOrchestratedJson({
        task: "supplement-vision",
        supabase: context.supabase,
        userId: context.userId,
        system: prompt,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Išanalizuok šio papildo etiketę." },
              { type: "image", image: data.image },
            ],
          },
        ],
        schema: SupplementVisionResultSchema,
        maxOutputTokens: 1_200,
      });
    } catch {
      return failedSupplementScan(
        data.lang === "lt" ? "Nepavyko nuskaityti papildo." : "Scan failed.",
      );
    }
  });
