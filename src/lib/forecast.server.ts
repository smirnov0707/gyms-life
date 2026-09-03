import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import {
  buildDeterministicPerformanceForecast,
  FORECAST_SOURCE_WINDOW_DAYS,
} from "./forecast.engine";
import type { DeterministicPerformanceForecast } from "./forecast.schema";
import { parseWorkoutSetLogs, WORKOUT_SET_LOG_SELECT } from "./workout-set-log.schema";

const FinishedWorkoutSessionIdSchema = z.object({ id: z.string().uuid() }).strict();

/**
 * Reads only the current user's completed sessions through RLS before the
 * deterministic forecast engine receives validated set-log domain objects.
 */
export async function loadDeterministicPerformanceForecast(
  supabase: SupabaseClient<Database>,
  userId: string,
  now = new Date(),
): Promise<DeterministicPerformanceForecast> {
  const since = new Date(now.getTime() - FORECAST_SOURCE_WINDOW_DAYS * 86_400_000).toISOString();
  const { data: sessions, error: sessionError } = await supabase
    .from("workout_sessions")
    .select("id")
    .eq("user_id", userId)
    .not("finished_at", "is", null)
    .gte("finished_at", since)
    .order("finished_at", { ascending: true })
    .limit(180);
  if (sessionError) throw new Error("Could not load completed workout sessions for forecast.");

  const parsedSessions = z.array(FinishedWorkoutSessionIdSchema).safeParse(sessions ?? []);
  if (!parsedSessions.success) throw new Error("Completed workout session data is invalid.");
  const sessionIds = parsedSessions.data.map((session) => session.id);
  if (sessionIds.length === 0) return buildDeterministicPerformanceForecast([], now);

  const { data: logs, error: logError } = await supabase
    .from("set_logs")
    .select(WORKOUT_SET_LOG_SELECT)
    .eq("user_id", userId)
    .in("session_id", sessionIds)
    .eq("done", true)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(2_000);
  if (logError) throw new Error("Could not load completed set logs for forecast.");

  return buildDeterministicPerformanceForecast(parseWorkoutSetLogs(logs ?? []), now);
}
