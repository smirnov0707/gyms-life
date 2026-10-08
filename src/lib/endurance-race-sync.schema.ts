import { z } from "zod";
import type { EnduranceSessionIntent } from "./endurance-race-goal.schema";
import type { RaceSessionMatch } from "./endurance-session-matching.engine";
import type { loadActiveRacePrep } from "./endurance-race-prep.service";

export const RetryEnduranceRaceSyncSchema = z
  .object({ workoutSessionId: z.string().uuid() })
  .strict();

export type EnduranceRaceMatch =
  | Extract<RaceSessionMatch, { status: "no_match" }>
  | (Exclude<RaceSessionMatch, { status: "no_match" }> & {
      raceGoalId: string;
      intent: EnduranceSessionIntent;
    })
  | {
      status: "already_linked";
      raceGoalId: string;
      plannedSessionKey: string;
      intent: EnduranceSessionIntent;
    };

type ActivePrep = Extract<Awaited<ReturnType<typeof loadActiveRacePrep>>, { status: "active" }>;
export type EnduranceRaceSyncResult = {
  raceMatch: EnduranceRaceMatch | null;
  raceIntelligence: {
    goalId: string;
    decision: ActivePrep["intelligence"];
    readiness: ActivePrep["readiness"];
  } | null;
  raceSync:
    | {
        status: "not_applicable" | "no_active_plan" | "no_match" | "needs_confirmation" | "matched";
      }
    | { status: "deferred"; phase: "matching" | "insights" };
};
