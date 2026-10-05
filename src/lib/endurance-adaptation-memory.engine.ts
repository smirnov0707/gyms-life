export type AdaptationHistoryItem={reason:string;association:"improved_signals"|"mixed_signals"|"worse_signals"|"insufficient_signal"|null};
export type AdaptationLesson={status:"insufficient_evidence"|"candidate";reason:string|null;supportingOutcomes:number;contradictingOutcomes:number;statement:string|null;provenance:"calculated"};
export function deriveAdaptationLesson(items:readonly AdaptationHistoryItem[]):AdaptationLesson{
 const reasons=[...new Set(items.map(x=>x.reason))];let best:{reason:string;good:number;bad:number}|null=null;
 for(const reason of reasons){const x=items.filter(i=>i.reason===reason),good=x.filter(i=>i.association==="improved_signals").length,bad=x.filter(i=>i.association==="worse_signals").length;if(good>=3&&good>=bad+2&&(!best||good>best.good))best={reason,good,bad}}
 if(!best)return{status:"insufficient_evidence",reason:null,supportingOutcomes:0,contradictingOutcomes:0,statement:null,provenance:"calculated"};
 return{status:"candidate",reason:best.reason,supportingOutcomes:best.good,contradictingOutcomes:best.bad,statement:"Repeated observed outcomes suggest this adaptation pattern may fit this athlete; association is not causal proof.",provenance:"calculated"};
}
