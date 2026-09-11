import { z } from "zod";
import type { PersonalExperimentGovernance } from "./personal-experiment-governance";

export const PersonalExperimentLifecycleStateSchema = z.enum([
  "draft",
  "eligible",
  "running",
  "stopped",
  "completed",
]);

export const PersonalExperimentLifecycleEventSchema = z.enum([
  "mark_eligible",
  "start",
  "user_stop",
  "adverse_signal",
  "protocol_deviation",
  "complete",
]);

export type PersonalExperimentLifecycleState = z.infer<
  typeof PersonalExperimentLifecycleStateSchema
>;
export type PersonalExperimentLifecycleEvent = z.infer<
  typeof PersonalExperimentLifecycleEventSchema
>;

export function nextPersonalExperimentState(input: {
  state: PersonalExperimentLifecycleState;
  event: PersonalExperimentLifecycleEvent;
  governance: PersonalExperimentGovernance;
}): PersonalExperimentLifecycleState {
  if (input.event === "adverse_signal") return "stopped";
  if (input.event === "protocol_deviation" && input.state === "running") return "stopped";
  if (input.event === "user_stop" && input.state === "running") return "stopped";

  if (input.event === "mark_eligible" && input.state === "draft") {
    return input.governance.eligibleToRun ? "eligible" : "draft";
  }
  if (input.event === "start" && input.state === "eligible") {
    return input.governance.eligibleToRun ? "running" : "eligible";
  }
  if (input.event === "complete" && input.state === "running") return "completed";
  return input.state;
}
