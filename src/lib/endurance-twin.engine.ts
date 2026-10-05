import { measureAerobicPaceDrift,type RunSplitEvidence } from "./endurance-pace-drift.engine";
export type EnduranceTwinSignal={key:"aerobic_drift"|"cadence_stability"|"split_pace_stability";provenance:"derived";value:number|null;status:"measured"|"insufficient_evidence";evidencePoints:number};
const cv=(xs:number[])=>{if(xs.length<2)return null;const mean=xs.reduce((a,b)=>a+b,0)/xs.length;if(mean===0)return null;const variance=xs.reduce((s,x)=>s+(x-mean)**2,0)/xs.length;return Math.sqrt(variance)/mean};
export function buildEnduranceTwinSignals(splits:readonly RunSplitEvidence[]):EnduranceTwinSignal[]{
 const drift=measureAerobicPaceDrift(splits);
 const cadence=splits.flatMap(s=>{const x=(s as RunSplitEvidence&{cadenceSpm?:number|null}).cadenceSpm;return x===null||x===undefined?[]:[x]});
 const paces=splits.filter(s=>s.distanceMeters>0&&s.durationSeconds>0).map(s=>s.durationSeconds/(s.distanceMeters/1000));
 const cadenceCv=cv(cadence),paceCv=cv(paces);
 return[
  {key:"aerobic_drift",provenance:"derived",value:drift.status==="measured"?drift.driftFraction:null,status:drift.status,evidencePoints:splits.filter(s=>s.averageHeartRateBpm!==null).length},
  {key:"cadence_stability",provenance:"derived",value:cadenceCv===null?null:Math.round((1-cadenceCv)*1000)/1000,status:cadence.length>=4?"measured":"insufficient_evidence",evidencePoints:cadence.length},
  {key:"split_pace_stability",provenance:"derived",value:paceCv===null?null:Math.round((1-paceCv)*1000)/1000,status:paces.length>=4?"measured":"insufficient_evidence",evidencePoints:paces.length},
 ];
}
