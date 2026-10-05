export type RunSplitEvidence={index:number;distanceMeters:number;durationSeconds:number;averageHeartRateBpm:number|null};
export type PaceDrift={status:"insufficient_evidence";driftFraction:null}|{status:"measured";driftFraction:number;firstHalfEfficiency:number;secondHalfEfficiency:number};
const avg=(x:number[])=>x.reduce((a,b)=>a+b,0)/x.length;
export function measureAerobicPaceDrift(splits:readonly RunSplitEvidence[]):PaceDrift{
 const valid=splits.filter(s=>s.distanceMeters>0&&s.durationSeconds>0&&s.averageHeartRateBpm!==null&&s.averageHeartRateBpm>=30);
 if(valid.length<4)return{status:"insufficient_evidence",driftFraction:null};
 const mid=Math.floor(valid.length/2);
 const eff=(xs:RunSplitEvidence[])=>avg(xs.map(s=>(s.distanceMeters/s.durationSeconds)/(s.averageHeartRateBpm!)));
 const first=eff(valid.slice(0,mid)),second=eff(valid.slice(mid));
 return{status:"measured",driftFraction:Math.round(((second/first)-1)*1000)/1000,firstHalfEfficiency:first,secondHalfEfficiency:second};
}
