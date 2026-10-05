import type{CoachContext,CoachRecommendation}from"./ai-coach.contract";
export type GovernedCoachRecommendation={recommendation:CoachRecommendation;enduranceExecution:"allowed"|"blocked";violations:string[]};
export function governCoachRecommendation(context:CoachContext,recommendation:CoachRecommendation):GovernedCoachRecommendation{
 const violations:string[]=[];const e=context.endurance;
 if(!e.active)return{recommendation,enduranceExecution:"allowed",violations};
 for(const action of recommendation.actions){
  if(action.type==="INCREASE_LOAD")violations.push("endurance_load_increase_requires_deterministic_plan");
  if(action.type==="DECREASE_LOAD"&&action.unit==="percent"&&action.value!==null&&action.value<0)violations.push("invalid_negative_load_reduction");
 }
 const text=[recommendation.summary,...recommendation.rationale,...recommendation.actions.map(a=>a.instruction)].join(" ").toLowerCase();
 const banned=[["vo2max","vo2max_without_measurement"],["guarantee","guaranteed_race_time"],["diagnos","diagnosis"]];
 for(const[needle,code]of banned)if(text.includes(needle)&&e.prohibitedClaims.includes(code as never))violations.push(code);
 if(e.postRun?.nextAction==="protect_recovery"&&recommendation.actions.some(a=>a.type==="INCREASE_LOAD"||a.type==="KEEP_PLAN"))violations.push("post_run_recovery_guard_conflict");
 if(e.readiness==="strained"&&recommendation.decision==="ADJUST_PROGRAM"&&recommendation.actions.some(a=>a.type==="INCREASE_LOAD"))violations.push("strained_readiness_load_increase");
 return{recommendation,enduranceExecution:violations.length?"blocked":"allowed",violations:[...new Set(violations)]};
}
