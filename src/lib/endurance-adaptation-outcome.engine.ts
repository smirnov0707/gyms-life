export type AdaptationOutcomeInput={sessionsAfter:number;lowResponseStreakAfter:number;readinessBandAfter:"low"|"moderate"|"high"|"unknown";daysObserved:number};
export type AdaptationOutcome={status:"too_early"|"observed";association:"improved_signals"|"mixed_signals"|"worse_signals"|"insufficient_signal";facts:string[];causalClaim:false};
export function assessAdaptationOutcome(x:AdaptationOutcomeInput):AdaptationOutcome{
 if(x.daysObserved<3)return{status:"too_early",association:"insufficient_signal",facts:["observation_window_under_3_days"],causalClaim:false};
 const facts=["sessions_after:"+x.sessionsAfter,"low_response_streak_after:"+x.lowResponseStreakAfter,"readiness_after:"+x.readinessBandAfter];
 if(x.readinessBandAfter==="high"&&x.lowResponseStreakAfter===0)return{status:"observed",association:"improved_signals",facts,causalClaim:false};
 if(x.readinessBandAfter==="low"&&x.lowResponseStreakAfter>=2)return{status:"observed",association:"worse_signals",facts,causalClaim:false};
 return{status:"observed",association:"mixed_signals",facts,causalClaim:false};
}
