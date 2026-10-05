export type TerrainRunEvidence={day:string;distanceMeters:number;elevationGainMeters:number|null;durationSeconds:number;averageHeartRateBpm:number|null};
export type TerrainContext={classification:"unknown"|"flat"|"rolling"|"hilly";gainPerKm:number|null;provenance:"measured"};
export function classifyTerrain(run:TerrainRunEvidence):TerrainContext{
 if(run.elevationGainMeters===null||run.distanceMeters<=0)return{classification:"unknown",gainPerKm:null,provenance:"measured"};
 const g=Math.round((run.elevationGainMeters/(run.distanceMeters/1000))*10)/10;
 return{classification:g<8?"flat":g<20?"rolling":"hilly",gainPerKm:g,provenance:"measured"};
}
export type TerrainResponse={status:"insufficient_evidence"|"measured";flatMedianPace:number|null;hillyMedianPace:number|null;observedPaceDifferenceFraction:number|null;runs:number};
const med=(x:number[])=>{if(!x.length)return null;const a=[...x].sort((p,q)=>p-q),m=Math.floor(a.length/2);return a.length%2?a[m]!:((a[m-1]!+a[m]!)/2)};
export function assessTerrainResponse(runs:readonly TerrainRunEvidence[]):TerrainResponse{
 const valid=runs.filter(r=>r.distanceMeters>=3000&&r.durationSeconds>0&&r.elevationGainMeters!==null);
 const flat=valid.filter(r=>classifyTerrain(r).classification==="flat").map(r=>r.durationSeconds/(r.distanceMeters/1000));
 const hill=valid.filter(r=>classifyTerrain(r).classification==="hilly").map(r=>r.durationSeconds/(r.distanceMeters/1000));
 if(flat.length<3||hill.length<3)return{status:"insufficient_evidence",flatMedianPace:med(flat),hillyMedianPace:med(hill),observedPaceDifferenceFraction:null,runs:valid.length};
 const f=med(flat)!,h=med(hill)!;return{status:"measured",flatMedianPace:f,hillyMedianPace:h,observedPaceDifferenceFraction:Math.round(((h/f)-1)*1000)/1000,runs:valid.length};
}
