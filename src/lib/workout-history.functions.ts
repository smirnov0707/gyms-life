import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseCompletedWorkoutSessions, WORKOUT_SESSION_SELECT } from "./workout-session.schema";
import { parseWorkoutSetLogs, WORKOUT_SET_LOG_SELECT } from "./workout-set-log.schema";

const Input = z.object({ limit: z.number().int().min(1).max(50).default(20) });

export const getWorkoutHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => Input.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rawSessions, error } = await supabase
      .from("workout_sessions")
      .select(WORKOUT_SESSION_SELECT)
      .eq("user_id", userId)
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: false })
      .limit(data.limit);

    if (error) throw new Error(`Workout history lookup failed: ${error.message}`);
    const sessions = parseCompletedWorkoutSessions(rawSessions ?? []);
    if (!sessions.length) return { sessions: [] as const };

    const ids = sessions.map((session) => session.id);
    const { data: logs, error: logsError } = await supabase
      .from("set_logs")
      .select(WORKOUT_SET_LOG_SELECT)
      .eq("user_id", userId)
      .in("session_id", ids)
      // Ordered by when each set was performed: a session that lost
      // signal partway through syncs its offline sets last, so write order
      // would interleave them after sets that came later in the gym.
      .order("performed_at", { ascending: true });

    if (logsError) throw new Error(`Workout history set lookup failed: ${logsError.message}`);

    const bySession = new Map<string, ReturnType<typeof parseWorkoutSetLogs>>();
    for (const log of parseWorkoutSetLogs(logs ?? [])) {
      const current = bySession.get(log.sessionId) ?? [];
      current.push(log);
      bySession.set(log.sessionId, current);
    }

    return {
      sessions: sessions.map((session) => ({
        session,
        sets: bySession.get(session.id) ?? [],
      })),
    };
  });
