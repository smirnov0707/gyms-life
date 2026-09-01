import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CheckinInput = z.object({
  sleepHours: z.number().min(3).max(14),
  energy: z.number().min(1).max(5),
  soreness: z.enum(["none", "mild", "moderate", "severe"]),
  stress: z.number().min(1).max(5),
  lang: z.string().default("lt"),
});

const sorenessScore: Record<z.infer<typeof CheckinInput>["soreness"], number> = {
  none: 0,
  mild: 1,
  moderate: 2,
  severe: 3,
};

export const submitReadinessCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => CheckinInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let baseScore = 50;
    baseScore += Math.min(data.sleepHours * 5, 40);
    baseScore += data.energy * 5;
    baseScore -= data.stress * 4;
    baseScore -= sorenessScore[data.soreness] * 6;
    const finalScore = Math.max(20, Math.min(100, Math.round(baseScore)));

    const { error } = await supabase.from("daily_checkins").upsert(
      {
        user_id: userId,
        checkin_on: new Date().toISOString().slice(0, 10),
        readiness_score: finalScore,
        sleep_hours: data.sleepHours,
        energy: data.energy,
        soreness: sorenessScore[data.soreness],
        stress: data.stress,
        load_modifier: finalScore < 60 ? 0.7 : finalScore < 80 ? 0.9 : 1,
      },
      { onConflict: "user_id,checkin_on" },
    );

    if (error) console.error("Readiness save error:", error.message);

    let recommendation = "Optimalus pasirengimas maksimaliam tūriui ir intensyvumui.";
    if (finalScore < 60) {
      recommendation = "Didelis nuovargis: rekomenduojama sumažinti serijų skaičių 20-30% arba atlikti lengvą atsistatymo sesiją.";
    } else if (finalScore < 80) {
      recommendation = "Vidutinis pasirengimas: atlikite suplanuotą programą, išlaikykite RPE <= 8.";
    }

    return { ok: !error, score: finalScore, recommendation };
  });

export const getLatestReadiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("daily_checkins")
      .select("*")
      .eq("user_id", context.userId)
      .order("checkin_on", { ascending: false })
      .limit(1)
      .maybeSingle();

    return { data: data || null };
  });
