import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/integrations/supabase/types";

/**
 * Aggregates the last 30 days of real user data for the monthly / medical
 * report. Everything here is read through RLS as the user, so numbers in the
 * PDF are always their own — no placeholders.
 */

type ReportProfile = Pick<
  Tables<"profiles">,
  | "display_name"
  | "birth_year"
  | "gender"
  | "height_cm"
  | "weight_kg"
  | "target_weight_kg"
  | "experience"
  | "goal"
  | "limitations"
  | "diet"
  | "allergies"
  | "days_per_week"
>;

export type ReportStats = {
  from: string;
  to: string;
  sessions: number;
  totalVolumeKg: number;
  trainingMinutes: number;
  avgSessionMinutes: number;
  sessionsPerWeek: number;
  checkins: number;
  avgReadiness: number | null;
  avgSleepHours: number | null;
  avgSoreness: number | null;
  avgStress: number | null;
  avgEnergy: number | null;
  nutritionDaysLogged: number;
  avgKcal: number | null;
  avgProtein: number | null;
  avgCarbs: number | null;
  avgFat: number | null;
  weightStartKg: number | null;
  weightEndKg: number | null;
  weightDeltaKg: number | null;
  bodyFatStart: number | null;
  bodyFatEnd: number | null;
  topLifts: { exercise: string; bestWeight: number; reps: number }[];
  supplements: { name: string; dose: string | null; timesPerDay: number | null }[];
  profile: ReportProfile | null;
};

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const avg = (values: (number | null)[]) => {
  const xs = values.filter((v): v is number => v != null);
  if (!xs.length) return null;
  return Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;
};

export async function buildReportStats(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<ReportStats> {
  const to = new Date();
  const from = new Date(Date.now() - 30 * 864e5);
  const fromIso = from.toISOString();
  const fromDay = fromIso.slice(0, 10);

  const [sessionsRes, checkinsRes, nutriRes, bodyRes, setsRes, suppRes, profileRes] =
    await Promise.all([
      supabase
        .from("workout_sessions")
        .select("id, title, started_at, total_volume, duration_seconds")
        .eq("user_id", userId)
        .not("finished_at", "is", null)
        .gte("started_at", fromIso)
        .order("started_at", { ascending: false }),
      supabase
        .from("daily_checkins")
        .select("checkin_on, readiness_score, sleep_hours, soreness, stress, energy")
        .eq("user_id", userId)
        .gte("checkin_on", fromDay),
      supabase
        .from("nutrition_logs")
        .select("logged_on, calories, protein, carbs, fat")
        .eq("user_id", userId)
        .gte("logged_on", fromDay),
      supabase
        .from("body_metrics")
        .select("measured_on, weight_kg, body_fat")
        .eq("user_id", userId)
        .gte("measured_on", fromDay)
        .order("measured_on", { ascending: true }),
      supabase
        .from("set_logs")
        // Windowed by when the training happened, not when the row was
        // written, so an offline-synced set lands in the right period.
        .select("exercise_name, weight_kg, reps, performed_at")
        .eq("user_id", userId)
        .gte("performed_at", fromIso)
        .limit(2000),
      supabase
        .from("supplements")
        .select("name, dose, times_per_day")
        .eq("user_id", userId)
        .eq("is_active", true)
        .limit(20),
      supabase
        .from("profiles")
        .select(
          "display_name, birth_year, gender, height_cm, weight_kg, target_weight_kg, experience, goal, limitations, diet, allergies, days_per_week",
        )
        .eq("id", userId)
        .maybeSingle(),
    ]);

  const sessions = sessionsRes.data ?? [];
  const totalVolumeKg = Math.round(sessions.reduce((a, s) => a + (num(s.total_volume) ?? 0), 0));
  const trainingSeconds = sessions.reduce((a, s) => a + (num(s.duration_seconds) ?? 0), 0);
  const trainingMinutes = Math.round(trainingSeconds / 60);

  const checkins = checkinsRes.data ?? [];
  const nutri = nutriRes.data ?? [];

  const perDay = new Map<string, { kcal: number; p: number; c: number; f: number }>();
  for (const row of nutri) {
    const key = row.logged_on;
    const acc = perDay.get(key) ?? { kcal: 0, p: 0, c: 0, f: 0 };
    acc.kcal += num(row.calories) ?? 0;
    acc.p += num(row.protein) ?? 0;
    acc.c += num(row.carbs) ?? 0;
    acc.f += num(row.fat) ?? 0;
    perDay.set(key, acc);
  }
  const days = [...perDay.values()];

  const body = bodyRes.data ?? [];
  const first = body[0] ?? null;
  const last = body[body.length - 1] ?? null;
  const weightStartKg = first ? num(first.weight_kg) : null;
  const weightEndKg = last ? num(last.weight_kg) : null;

  const bestByExercise = new Map<string, { bestWeight: number; reps: number }>();
  for (const row of setsRes.data ?? []) {
    const name = row.exercise_name.trim();
    const w = num(row.weight_kg) ?? 0;
    const reps = num(row.reps) ?? 0;
    if (!name || w <= 0) continue;
    const prev = bestByExercise.get(name);
    if (!prev || w > prev.bestWeight) bestByExercise.set(name, { bestWeight: w, reps });
  }
  const topLifts = [...bestByExercise.entries()]
    .map(([exercise, v]) => ({ exercise, ...v }))
    .sort((a, b) => b.bestWeight - a.bestWeight)
    .slice(0, 8);

  return {
    from: fromDay,
    to: to.toISOString().slice(0, 10),
    sessions: sessions.length,
    totalVolumeKg,
    trainingMinutes,
    avgSessionMinutes: sessions.length ? Math.round(trainingMinutes / sessions.length) : 0,
    sessionsPerWeek: Math.round((sessions.length / 30) * 7 * 10) / 10,
    checkins: checkins.length,
    avgReadiness: avg(checkins.map((c) => num(c.readiness_score))),
    avgSleepHours: avg(checkins.map((c) => num(c.sleep_hours))),
    avgSoreness: avg(checkins.map((c) => num(c.soreness))),
    avgStress: avg(checkins.map((c) => num(c.stress))),
    avgEnergy: avg(checkins.map((c) => num(c.energy))),
    nutritionDaysLogged: perDay.size,
    avgKcal: avg(days.map((d) => Math.round(d.kcal))),
    avgProtein: avg(days.map((d) => Math.round(d.p))),
    avgCarbs: avg(days.map((d) => Math.round(d.c))),
    avgFat: avg(days.map((d) => Math.round(d.f))),
    weightStartKg,
    weightEndKg,
    weightDeltaKg:
      weightStartKg != null && weightEndKg != null
        ? Math.round((weightEndKg - weightStartKg) * 10) / 10
        : null,
    bodyFatStart: first ? num(first.body_fat) : null,
    bodyFatEnd: last ? num(last.body_fat) : null,
    topLifts,
    supplements: (suppRes.data ?? []).map((s) => ({
      name: s.name,
      dose: s.dose,
      timesPerDay: num(s.times_per_day),
    })),
    profile: profileRes.data,
  };
}

export function statsToPrompt(s: ReportStats): string {
  const profile = s.profile;
  const age = profile?.birth_year ? new Date().getFullYear() - profile.birth_year : null;
  return [
    `PERIOD: ${s.from} → ${s.to} (30 days)`,
    `SUBJECT: age=${age ?? "?"}, gender=${profile?.gender ?? "?"}, height=${profile?.height_cm ?? "?"}cm, goal=${profile?.goal ?? "?"}, experience=${profile?.experience ?? "?"}, limitations=${profile?.limitations ?? "none"}, diet=${profile?.diet ?? "?"}, allergies=${profile?.allergies ?? "none"}`,
    `TRAINING: sessions=${s.sessions}, ${s.sessionsPerWeek}/week, total volume=${s.totalVolumeKg}kg, total time=${s.trainingMinutes}min, avg session=${s.avgSessionMinutes}min`,
    `TOP LIFTS: ${s.topLifts.length ? s.topLifts.map((l) => `${l.exercise} ${l.bestWeight}kg×${l.reps}`).join("; ") : "no logged sets"}`,
    `RECOVERY: check-ins=${s.checkins}, avg readiness=${s.avgReadiness ?? "—"}, avg sleep=${s.avgSleepHours ?? "—"}h, soreness=${s.avgSoreness ?? "—"}, stress=${s.avgStress ?? "—"}, energy=${s.avgEnergy ?? "—"}`,
    `NUTRITION: days logged=${s.nutritionDaysLogged}/30, avg ${s.avgKcal ?? "—"} kcal, P${s.avgProtein ?? "—"} C${s.avgCarbs ?? "—"} F${s.avgFat ?? "—"} g/day`,
    `BODY: weight ${s.weightStartKg ?? "—"}kg → ${s.weightEndKg ?? "—"}kg (Δ ${s.weightDeltaKg ?? "—"}kg), body fat ${s.bodyFatStart ?? "—"}% → ${s.bodyFatEnd ?? "—"}%, target ${profile?.target_weight_kg ?? "—"}kg`,
    `SUPPLEMENTS: ${s.supplements.length ? s.supplements.map((x) => `${x.name} ${x.dose ?? ""} ×${x.timesPerDay ?? 1}`).join("; ") : "none"}`,
  ].join("\n");
}
