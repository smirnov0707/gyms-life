import { RunTelemetrySchema,type RunTelemetry } from "./endurance-run-telemetry.schema";
export type NormalizedRunTelemetry=RunTelemetry&{paceSecondsPerKm:number;splitCoverage:number};
export function normalizeRunTelemetry(value:unknown):NormalizedRunTelemetry{
 const v=RunTelemetrySchema.parse(value);
 const splitDistance=v.splits.reduce((s,x)=>s+x.distanceMeters,0);
 return {...v,paceSecondsPerKm:v.durationSeconds/(v.distanceMeters/1000),splitCoverage:v.distanceMeters>0?Math.min(1,splitDistance/v.distanceMeters):0};
}
