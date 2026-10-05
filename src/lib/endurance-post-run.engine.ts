import type{FatigueDecoupling}from"./endurance-fatigue-decoupling.engine";import type{RaceSessionMatch}from"./endurance-session-matching.engine";
export type PostRunBrief={headline:"completed"|"strong_control"|"fatigue_detected"|"race_session_completed"|"building_evidence";facts:string[];nextAction:"continue_plan"|"protect_recovery"|"confirm_session"|"collect_more_data";provenance:"derived"};
export function buildPostRunBrief(input:{distanceMeters:number;durationSeconds:number;match:RaceSessionMatch|null;fatigue:FatigueDecoupling|null;readinessBand:"low"|"moderate"|"high"|"unknown"}):PostRunBrief{
 const pace=input.distanceMeters>0?input.durationSeconds/(input.distanceMeters/1000):null;const facts=["distance_km:"+(Math.round(input.distanceMeters/100)/10),...(pace===null?[]:["pace_sec_km:"+Math.round(pace)])];
 if(input.match?.status==="needs_confirmation")return{headline:"completed",facts:[...facts,"match_candidate:"+input.match.score],nextAction:"confirm_session",provenance:"derived"};
 if(input.fatigue?.status==="measured"&&input.fatigue.pattern==="multi_signal_fatigue")return{headline:"fatigue_detected",facts:[...facts,"late_run:pace_hr_cadence_decoupling"],nextAction:"protect_recovery",provenance:"derived"};
 if(input.readinessBand==="low"&&input.fatigue?.status==="measured"&&input.fatigue.pattern==="cardiovascular_drift")return{headline:"fatigue_detected",facts:[...facts,"low_readiness_with_cardiovascular_drift"],nextAction:"protect_recovery",provenance:"derived"};
 if(input.match?.status==="confident")return{headline:"race_session_completed",facts:[...facts,"match_score:"+input.match.score],nextAction:"continue_plan",provenance:"derived"};
 if(input.fatigue?.status==="measured"&&input.fatigue.pattern==="none")return{headline:"strong_control",facts:[...facts,"late_run:no_material_decoupling"],nextAction:"continue_plan",provenance:"derived"};
 return{headline:"building_evidence",facts,nextAction:"collect_more_data",provenance:"derived"};
}
