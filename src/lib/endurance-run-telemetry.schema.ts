import { z } from "zod";
export const RunTelemetrySourceSchema=z.enum(["apple_health","garmin","strava","device","manual_import"]);
export const RunSplitSchema=z.object({
 index:z.number().int().positive(),
 distanceMeters:z.number().finite().positive().max(10000),
 durationSeconds:z.number().finite().positive().max(7200),
 averageHeartRateBpm:z.number().int().min(30).max(240).nullable(),
 elevationGainMeters:z.number().finite().min(0).max(3000).nullable(),
 cadenceSpm:z.number().finite().min(40).max(260).nullable(),
}).strict();
export const RunTelemetrySchema=z.object({
 source:RunTelemetrySourceSchema,
 externalActivityId:z.string().trim().min(1).max(300),
 startedAt:z.string().datetime({offset:true}),
 distanceMeters:z.number().finite().positive().max(250000),
 durationSeconds:z.number().int().positive().max(86400),
 averageHeartRateBpm:z.number().int().min(30).max(240).nullable(),
 elevationGainMeters:z.number().finite().min(0).max(15000).nullable(),
 averageCadenceSpm:z.number().finite().min(40).max(260).nullable(),
 splits:z.array(RunSplitSchema).max(500),
}).strict().superRefine((v,c)=>{
 if(v.splits.length===0)return;
 const splitDistance=v.splits.reduce((s,x)=>s+x.distanceMeters,0);
 if(Math.abs(splitDistance-v.distanceMeters)/v.distanceMeters>.1)c.addIssue({code:"custom",path:["splits"],message:"Split distance must reconcile with activity distance within 10%."});
});
export type RunTelemetry=z.infer<typeof RunTelemetrySchema>;
