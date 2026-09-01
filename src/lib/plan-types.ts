import type { Tables } from "@/integrations/supabase/types";

export type {
  TrainingPlanData as PlanData,
  TrainingPlanDay as PlanDay,
  TrainingPlanExercise as PlanExercise,
} from "./training-plan.schema";

export type PlanRow = Tables<"plans">;
