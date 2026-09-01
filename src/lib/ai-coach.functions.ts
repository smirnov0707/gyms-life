import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OpenAICoachWorker } from "./ai-coach.openai";
import { runCoachWorker } from "./ai-coach.worker";
import { assembleCoachContext } from "./ai-coach.server";

export const getCoachRecommendation=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async({context})=>{const coachContext=await assembleCoachContext({supabase:context.supabase,userId:context.userId});const recommendation=await runCoachWorker(new OpenAICoachWorker(),coachContext);return {status:"READY" as const,recommendation};});
