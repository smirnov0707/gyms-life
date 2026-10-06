import type{EndurancePlanSession}from"./endurance-race-goal.schema";import type{EnduranceAdaptationDecision}from"./endurance-adaptation.engine";
export type EffectiveEnduranceSession=EndurancePlanSession&{originalDistanceMeters:number|null;appliedVolumeModifier:number};
export function applyAdaptationToRemainingSessions(input:{sessions:readonly EndurancePlanSession[];completedIntents:ReadonlySet<string>;adaptation:EnduranceAdaptationDecision}):EffectiveEnduranceSession[]{
 return input.sessions.map(session=>{const completed=input.completedIntents.has(session.intent);const modifier=completed?1:input.adaptation.volumeModifier;const original=session.plannedDistanceMeters;return{...session,originalDistanceMeters:original,appliedVolumeModifier:modifier,plannedDistanceMeters:original===null?null:Math.max(500,Math.round((original*modifier)/100)*100)}});
}
