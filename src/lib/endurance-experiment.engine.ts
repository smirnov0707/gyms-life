import type { EnduranceExperiment } from "./endurance-experiment.schema";
export type ExperimentSafetyContext = {
  racePhase: "base" | "build" | "specific" | "taper" | "race" | null;
  readiness: "insufficient_evidence" | "building" | "on_track" | "strained" | null;
  adaptationAction: "hold" | "reduce" | "recover" | null;
};
export type ExperimentGate = {
  allowed: boolean;
  reason: "allowed" | "race_week" | "taper_phase" | "strained_readiness" | "active_recovery_guard";
};
export function gateEnduranceExperiment(
  _experiment: EnduranceExperiment,
  ctx: ExperimentSafetyContext,
): ExperimentGate {
  if (ctx.racePhase === "race") return { allowed: false, reason: "race_week" };
  if (ctx.racePhase === "taper") return { allowed: false, reason: "taper_phase" };
  if (ctx.readiness === "strained") return { allowed: false, reason: "strained_readiness" };
  if (ctx.adaptationAction === "recover" || ctx.adaptationAction === "reduce")
    return { allowed: false, reason: "active_recovery_guard" };
  return { allowed: true, reason: "allowed" };
}
