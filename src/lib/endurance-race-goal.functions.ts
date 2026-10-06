import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { RaceGoalSchema } from "./endurance-race-goal.schema";

const Input = z.object({ goal: RaceGoalSchema }).strict();

export const startRacePreparation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => Input.parse(value))
  .handler(async ({ data, context }) => {
    const { createRaceGoal } = await import("./endurance-race-goal.service");
    const { loadPersistedProfileTimeZone } = await import("./user-context.server");
    const { dayInTimeZone } = await import("./local-day");
    const timeZone = await loadPersistedProfileTimeZone(context.supabase, context.userId);
    const today = dayInTimeZone(new Date(), timeZone);
    const result = await createRaceGoal(context.supabase, context.userId, data.goal, today);

    const { tryPersistCurrentEnduranceAdaptation } =
      await import("./endurance-adaptation-refresh.service");
    await tryPersistCurrentEnduranceAdaptation(context.supabase, context.userId, today, timeZone);

    return result;
  });
