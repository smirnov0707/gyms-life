import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SupportedLanguageSchema } from "./language.schema";

const CheckinInput = z.object({
  sleepHours: z.number().min(3).max(14),
  energy: z.number().min(1).max(5),
  soreness: z.enum(["none", "mild", "moderate", "severe"]),
  stress: z.number().min(1).max(5),
  lang: SupportedLanguageSchema.default("lt"),
});

export const submitReadinessCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => CheckinInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let baseScore = 50;
    baseScore += Math.min(data.sleepHours * 5, 40);
    baseScore += data.energy * 5;
    baseScore -= data.stress * 4;
    if (data.soreness === "mild") baseScore -= 5;
    if (data.soreness === "moderate") baseScore -= 12;
    if (data.soreness === "severe") baseScore -= 22;

    const finalScore = Math.max(20, Math.min(100, Math.round(baseScore)));

    const { error } = await supabase.from("readiness_checkins").insert({
      user_id: userId,
      score: finalScore,
      sleep_hours: data.sleepHours,
      energy: data.energy,
      soreness: data.soreness,
      stress: data.stress,
    });

    if (error) throw new Error("Could not save readiness check-in.");

    let recommendation = "Optimalus pasirengimas maksimaliam tūriui ir intensyvumui.";
    if (finalScore < 60) {
      recommendation =
        "Didelis nuovargis: rekomenduojama sumažinti serijų skaičių 20-30% arba atlikti lengvą atsistatymo sesiją.";
    } else if (finalScore < 80) {
      recommendation =
        "Vidutinis pasirengimas: atlikite suplanuotą programą, išlaikykite RPE <= 8.";
    }

    return {
      ok: true,
      score: finalScore,
      recommendation,
    };
  });

export const getLatestReadiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("readiness_checkins")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error("Could not load latest readiness check-in.");

    return { data: data ?? null };
  });
