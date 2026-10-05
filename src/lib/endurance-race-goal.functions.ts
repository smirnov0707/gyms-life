import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { RaceGoalSchema } from "./endurance-race-goal.schema";

const Input = z.object({ today: z.string().date(), goal: RaceGoalSchema }).strict();

export const startRacePreparation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => Input.parse(value))
  .handler(async ({ data, context }) => {
    const { createRaceGoal } = await import("./endurance-race-goal.service");
    return createRaceGoal(context.supabase, context.userId, data.goal, data.today);
  });
