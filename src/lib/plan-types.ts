export type PlanExercise = {
  slug: string;
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  notes?: string;
};

export type PlanDay = {
  day: number;
  title: string;
  focus: string;
  warmup: string;
  cooldown: string;
  estimated_minutes: number;
  exercises: PlanExercise[];
};

export type PlanData = {
  title: string;
  summary: string;
  weeks: number;
  progression: string;
  nutrition: string;
  days: PlanDay[];
};

export type PlanRow = {
  id: string;
  title: string;
  goal: string | null;
  weeks: number;
  days_per_week: number;
  created_at: string;
  data: PlanData;
};
