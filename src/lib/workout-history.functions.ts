import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({ limit: z.number().int().min(1).max(50).default(20) });

export const getWorkoutHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => Input.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: sessions, error } = await supabase
      .from("workout_sessions")
      .select(
        "id, plan_id, day_index, title, started_at, finished_at, duration_seconds, total_volume",
      )
      .eq("user_id", userId)
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: false })
      .limit(data.limit);

    if (error) throw new Error(`Workout history lookup failed: ${error.message}`);
    if (!sessions?.length) return { sessions: [] as const };

    const ids = sessions.map((session) => session.id);
    const { data: logs, error: logsError } = await supabase
      .from("set_logs")
      .select(
        "id, session_id, exercise_slug, exercise_name, set_number, reps, weight_kg, rpe, done, created_at",
      )
      .eq("user_id", userId)
      .in("session_id", ids)
      .order("created_at", { ascending: true });

    if (logsError) throw new Error(`Workout history set lookup failed: ${logsError.message}`);

    const bySession = new Map<string, typeof logs>();
    for (const log of logs ?? []) {
      const current = bySession.get(log.session_id) ?? [];
      current.push(log);
      bySession.set(log.session_id, current);
    }

    return {
      sessions: sessions.map((session) => ({
        ...session,
        sets: bySession.get(session.id) ?? [],
      })),
    };
  });
