import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type PerformanceSetLog = { id: string; session_id: string; exercise_slug: string; exercise_name: string; set_number: number; reps: number | null; weight_kg: number | null; rpe: number | null; done: boolean; created_at: string };
export type PerformanceSession = { id: string; plan_id: string; day_index: number; title: string; started_at: string; finished_at: string | null; duration_seconds: number | null; total_volume: number | null };

export async function loadCompletedPerformanceData(supabase: SupabaseClient<Database>, userId: string) {
  const { data: sessions, error: sessionError } = await supabase.from("workout_sessions").select("id, plan_id, day_index, title, started_at, finished_at, duration_seconds, total_volume").eq("user_id", userId).not("finished_at", "is", null).order("finished_at", { ascending: true });
  if (sessionError) throw new Error(`Performance session lookup failed: ${sessionError.message}`);
  const sessionRows = (sessions ?? []) as PerformanceSession[];
  if (!sessionRows.length) return { sessions: [], logs: [] as PerformanceSetLog[] };
  const ids = sessionRows.map((session) => session.id);
  const { data: logs, error: logError } = await supabase.from("set_logs").select("id, session_id, exercise_slug, exercise_name, set_number, reps, weight_kg, rpe, done, created_at").eq("user_id", userId).in("session_id", ids).eq("done", true).order("created_at", { ascending: true });
  if (logError) throw new Error(`Performance set lookup failed: ${logError.message}`);
  return { sessions: sessionRows, logs: (logs ?? []) as PerformanceSetLog[] };
}
