import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ReminderSchema = z.object({
  workoutTime: z.string().default("18:00"),
  waterReminders: z.boolean().default(true),
  preWorkoutAlert: z.boolean().default(true),
  eveningRecovery: z.boolean().default(true),
});

export const getRemindersSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data } = await supabase
      .from("reminders")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    return {
      settings: data || {
        workout_time: "18:00",
        water_reminders: true,
        pre_workout_alert: true,
        evening_recovery: true,
      },
    };
  });

export const saveRemindersSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => ReminderSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { error } = await supabase.from("reminders").upsert({
      user_id: userId,
      workout_time: data.workoutTime,
      water_reminders: data.waterReminders,
      pre_workout_alert: data.preWorkoutAlert,
      evening_recovery: data.eveningRecovery,
      updated_at: new Date().toISOString(),
    });

    if (error) throw new Error("Could not save reminder settings.");
    return { ok: true };
  });
