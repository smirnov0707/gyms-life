import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { IanaTimeZoneSchema } from "./local-day";

const Input = z.object({ sessionId: z.string().uuid(), timeZone: IanaTimeZoneSchema }).strict();

export const finishWorkout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { finishWorkoutSession } = await import("./finish-workout.service");
    return finishWorkoutSession(context.supabase, context.userId, data);
  });
