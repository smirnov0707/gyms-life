import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import {
  MuscleLoadExerciseSourceSchema,
  type MuscleLoadExerciseSource,
} from "./muscle-load.schema";
import {
  buildSessionMuscleBreakdown,
  SessionSetSourceSchema,
  type SessionMuscleContribution,
} from "./session-muscle-breakdown";

export type SessionReplayResult = {
  muscleBreakdown: SessionMuscleContribution[];
  replayStatus: "available" | "unavailable";
};

/** Optional presentation read. Call only after authorizing the parent session. */
export async function loadCompletedSessionReplay(
  supabase: SupabaseClient<Database>,
  userId: string,
  sessionId: string,
  sourceSets?: unknown,
): Promise<SessionReplayResult> {
  try {
    let rawSets = sourceSets;
    if (rawSets === undefined) {
      const result = await supabase
        .from("set_logs")
        .select("exercise_slug, reps, weight_kg, done")
        .eq("session_id", sessionId)
        .eq("user_id", userId);
      if (result.error || result.data === null) {
        throw new Error("REPLAY_LOG_READ_FAILED");
      }
      rawSets = result.data;
    }

    const parsed = z.array(SessionSetSourceSchema).safeParse(rawSets);
    if (!parsed.success) throw new Error("REPLAY_LOG_INVALID");
    const slugs = [
      ...new Set(parsed.data.filter((set) => set.done === true).map((set) => set.exercise_slug)),
    ];
    if (slugs.length === 0) {
      return { muscleBreakdown: [], replayStatus: "available" };
    }

    let catalogue: MuscleLoadExerciseSource[] = [];
    let catalogueAvailable = false;
    try {
      const result = await supabase
        .from("exercises")
        .select("slug, muscle_group")
        .in("slug", slugs);
      if (!result.error && result.data !== null) {
        const checked = z.array(MuscleLoadExerciseSourceSchema).safeParse(result.data);
        if (checked.success) {
          catalogue = checked.data;
          catalogueAvailable = true;
        }
      }
    } catch {
      // A transport exception and a query error are the same unavailable source.
    }
    if (!catalogueAvailable) {
      console.warn("[SessionReplay] REPLAY_CATALOGUE_UNAVAILABLE");
    }
    return {
      muscleBreakdown: buildSessionMuscleBreakdown(parsed.data, catalogue, catalogueAvailable),
      replayStatus: "available",
    };
  } catch {
    // Never print raw rows, user identifiers or database errors. An unavailable
    // replay must not undo an already committed workout or look like zero work.
    console.warn("[SessionReplay] REPLAY_UNAVAILABLE");
    return { muscleBreakdown: [], replayStatus: "unavailable" };
  }
}
