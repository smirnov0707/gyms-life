export type ExperimentMetricObservation={period:"baseline"|"test";value:number};
export type EnduranceExperimentResult={status:"insufficient_evidence"|"observed";direction:"better"|"similar"|"worse"|"unknown";baselineMean:number|null;testMean:number|null;relativeDifference:number|null;causalClaim:false};
const mean=(x:number[])=>x.reduce((a,b)=>a+b,0)/x.length;
export function evaluateEnduranceExperiment(rows:readonly ExperimentMetricObservation[],higherIsBetter=true):EnduranceExperimentResult{
 const b=rows.filter(x=>x.period==="baseline").map(x=>x.value),t=rows.filter(x=>x.period==="test").map(x=>x.value);if(b.length<3||t.length<3)return{status:"insufficient_evidence",direction:"unknown",baselineMean:b.length?mean(b):null,testMean:t.length?mean(t):null,relativeDifference:null,causalClaim:false};
 const bm=mean(b),tm=mean(t),diff=bm===0?null:(tm-bm)/Math.abs(bm);if(diff===null)return{status:"observed",direction:"unknown",baselineMean:bm,testMean:tm,relativeDifference:null,causalClaim:false};const signed=higherIsBetter?diff:-diff;return{status:"observed",direction:signed>.05?"better":signed<-.05?"worse":"similar",baselineMean:bm,testMean:tm,relativeDifference:Math.round(diff*1000)/1000,causalClaim:false};
}
