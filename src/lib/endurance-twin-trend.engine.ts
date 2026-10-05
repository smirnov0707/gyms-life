export type EnduranceDerivedSnapshot={day:string;aerobicDrift:number|null;cadenceStability:number|null;paceStability:number|null};
export type EnduranceTrend={status:"insufficient_evidence"|"improving"|"stable"|"declining";metric:"aerobic_efficiency";recentMedian:number|null;priorMedian:number|null;sessions:number};
const median=(x:number[])=>{if(!x.length)return null;const a=[...x].sort((p,q)=>p-q),m=Math.floor(a.length/2);return a.length%2?a[m]!:((a[m-1]!+a[m]!)/2)};
export function assessAerobicEfficiencyTrend(rows:readonly EnduranceDerivedSnapshot[]):EnduranceTrend{
 const valid=rows.filter(r=>r.aerobicDrift!==null).sort((a,b)=>a.day.localeCompare(b.day));if(valid.length<6)return{status:"insufficient_evidence",metric:"aerobic_efficiency",recentMedian:null,priorMedian:null,sessions:valid.length};
 const mid=Math.floor(valid.length/2),prior=median(valid.slice(0,mid).map(r=>r.aerobicDrift!)),recent=median(valid.slice(mid).map(r=>r.aerobicDrift!));if(prior===null||recent===null)return{status:"insufficient_evidence",metric:"aerobic_efficiency",recentMedian:recent,priorMedian:prior,sessions:valid.length};
 const delta=recent-prior;return{status:delta>=.03?"declining":delta<=-.03?"improving":"stable",metric:"aerobic_efficiency",recentMedian:recent,priorMedian:prior,sessions:valid.length};
}
