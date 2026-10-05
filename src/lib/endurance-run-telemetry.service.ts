import type{SupabaseClient}from"@supabase/supabase-js";import type{Database}from"@/integrations/supabase/types";import{normalizeRunTelemetry}from"./endurance-run-telemetry.engine";
export async function persistRunTelemetry(supabase:SupabaseClient<Database>,userId:string,value:unknown){
 const t=normalizeRunTelemetry(value);
 const{data:existing,error:lookupError}=await supabase.from("endurance_run_imports").select("workout_session_id").eq("user_id",userId).eq("source",t.source).eq("external_activity_id",t.externalActivityId).maybeSingle();
 if(lookupError)throw lookupError;if(existing)return{status:"already_imported" as const,workoutSessionId:existing.workout_session_id};
 const finishedAt=new Date(new Date(t.startedAt).getTime()+t.durationSeconds*1000).toISOString();
 const{data:session,error:sessionError}=await supabase.from("workout_sessions").insert({user_id:userId,started_at:t.startedAt,finished_at:finishedAt,duration_seconds:t.durationSeconds,title:"Run",total_volume:0,activity_kind:"run",activity_environment:"outdoor",activity_source:"imported",distance_meters:t.distanceMeters,average_heart_rate_bpm:t.averageHeartRateBpm}).select("id").single();
 if(sessionError)throw sessionError;
 const{error:importError}=await supabase.from("endurance_run_imports").insert({user_id:userId,workout_session_id:session.id,source:t.source,external_activity_id:t.externalActivityId,split_coverage:t.splitCoverage});
 if(importError)throw importError;
 if(t.splits.length){const{error:splitError}=await supabase.from("endurance_run_splits").insert(t.splits.map(x=>({user_id:userId,workout_session_id:session.id,split_index:x.index,distance_meters:x.distanceMeters,duration_seconds:x.durationSeconds,average_heart_rate_bpm:x.averageHeartRateBpm,elevation_gain_meters:x.elevationGainMeters,cadence_spm:x.cadenceSpm})));if(splitError)throw splitError}
 return{status:"imported" as const,workoutSessionId:session.id,splitCoverage:t.splitCoverage};
}
