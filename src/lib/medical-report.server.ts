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

/** The seven reads this report is assembled from, named as the prompt names them. */
export const REPORT_SOURCES = [
  "training sessions",
  "logged sets",
  "daily check-ins",
  "nutrition log",
  "body measurements",
  "supplements",
  "profile",
] as const;

export type ReportSource = (typeof REPORT_SOURCES)[number];

export type ReportStats = {
  from: string;
  to: string;
  /**
   * Sources whose query failed. Not the same as a source with nothing in it,
   * and the difference matters more here than anywhere else in the app: this
   * text becomes a document a physician reads, and "no sessions" is a claim
   * about the athlete while "could not be read" is a claim about us.
   */
  unreadable: ReportSource[];
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
  /**
   * Where the logged meals came from, counted per entry. Every path in this
   * app produces an estimate, but "a model read a photograph" and "a model
   * read a sentence the athlete typed" are not the same evidence, and rows
   * written before provenance was recorded are neither.
   */
  nutritionSources: { photo: number; text: number; unrecorded: number };
  avgKcal: number | null;
  avgProtein: number | null;
  avgCarbs: number | null;
  avgFat: number | null;
  weightStartKg: number | null;
  weightEndKg: number | null;
  weightDeltaKg: number | null;
  bodyFatStart: number | null;
  bodyFatEnd: number | null;
  /**
   * Where the weights and body fat percentages came from.
   *
   * A physician reading "body fat 24% → 21%" is entitled to know whether that
   * was a scale and a caliper or a vision model's reading of a photograph.
   * `body_metrics` holds both under the same column names.
   */
  bodySources: { measured: number; photo: number; unrecorded: number };
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
        .select("logged_on, calories, protein, carbs, fat, source")
        .eq("user_id", userId)
        .gte("logged_on", fromDay),
      supabase
        .from("body_metrics")
        .select("measured_on, weight_kg, body_fat, weight_source, body_fat_source")
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

  // Which reads failed, recorded rather than absorbed. Everything below still
  // aggregates whatever did come back, so one broken source does not cost the
  // athlete the other six.
  const unreadable = (
    [
      ["training sessions", sessionsRes.error],
      ["logged sets", setsRes.error],
      ["daily check-ins", checkinsRes.error],
      ["nutrition log", nutriRes.error],
      ["body measurements", bodyRes.error],
      ["supplements", suppRes.error],
      ["profile", profileRes.error],
    ] satisfies [ReportSource, unknown][]
  )
    .filter(([, error]) => error)
    .map(([source]) => source);

  const sessions = sessionsRes.data ?? [];
  const totalVolumeKg = Math.round(sessions.reduce((a, s) => a + (num(s.total_volume) ?? 0), 0));
  const trainingSeconds = sessions.reduce((a, s) => a + (num(s.duration_seconds) ?? 0), 0);
  const trainingMinutes = Math.round(trainingSeconds / 60);

  const checkins = checkinsRes.data ?? [];
  const nutri = nutriRes.data ?? [];

  const nutritionSources = { photo: 0, text: 0, unrecorded: 0 };
  const perDay = new Map<string, { kcal: number; p: number; c: number; f: number }>();
  for (const row of nutri) {
    if (row.source === "photo_estimate") nutritionSources.photo += 1;
    else if (row.source === "text_estimate") nutritionSources.text += 1;
    else nutritionSources.unrecorded += 1;
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
  const bodySources = { measured: 0, photo: 0, unrecorded: 0 };
  for (const row of body) {
    // A row is only "measured" when both of its numbers were; one estimated
    // input is enough to make the pair an estimate.
    const sources = [row.weight_source, row.body_fat_source];
    if (sources.includes("photo_estimate")) bodySources.photo += 1;
    else if (sources.every((value) => value === "measured")) bodySources.measured += 1;
    else bodySources.unrecorded += 1;
  }
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
    unreadable,
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
    nutritionSources,
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
    bodySources,
    topLifts,
    supplements: (suppRes.data ?? []).map((s) => ({
      name: s.name,
      dose: s.dose,
      timesPerDay: num(s.times_per_day),
    })),
    profile: profileRes.data,
  };
}

/**
 * How the month's meals were captured, in words a physician can weigh.
 *
 * Every nutrition row in this app is a model's estimate — there is no
 * weighed-entry path — so the estimate caveat is unconditional. What varies
 * is the evidence behind it, and that is counted rather than asserted:
 * photographs, typed descriptions, and rows logged before the app recorded
 * which of the two it was.
 */
export function nutritionProvenanceNote(sources: ReportStats["nutritionSources"]): string {
  const { photo, text, unrecorded } = sources;
  const total = photo + text + unrecorded;
  if (total === 0) return "no meals logged";
  const parts: string[] = [];
  if (photo > 0) parts.push(`${photo} from photographs`);
  if (text > 0) parts.push(`${text} from typed descriptions`);
  if (unrecorded > 0) parts.push(`${unrecorded} with the capture method not recorded`);
  return `${total} entries, every one a model estimate and none weighed: ${parts.join(", ")}`;
}

/**
 * The same treatment as nutrition, for the same reason: these figures reach a
 * physician, and the photo scan writes into the same two columns a scale does.
 * Counted rather than asserted.
 */
export function bodyProvenanceNote(sources: ReportStats["bodySources"]): string {
  const { measured, photo, unrecorded } = sources;
  const total = measured + photo + unrecorded;
  if (total === 0) return "no measurements recorded";
  const parts: string[] = [];
  if (measured > 0) parts.push(`${measured} entered by the athlete`);
  if (photo > 0) {
    parts.push(`${photo} estimated by a model from a photograph, not measured`);
  }
  if (unrecorded > 0) parts.push(`${unrecorded} with the method not recorded`);
  return `${total} entries: ${parts.join(", ")}`;
}

export function statsToPrompt(s: ReportStats): string {
  const profile = s.profile;
  const age = profile?.birth_year ? new Date().getFullYear() - profile.birth_year : null;

  /**
   * A line whose source could not be read carries no figures at all.
   *
   * The model is told to use only the numbers in this block, so a failed
   * read left as `sessions=0` becomes "the athlete trained zero times" in a
   * document handed to a physician. Zero is a finding; "could not be read" is
   * not, and the two must never be written the same way.
   */
  const line = (source: ReportSource, label: string, body: () => string) =>
    s.unreadable.includes(source)
      ? `${label}: SOURCE COULD NOT BE READ — no figures available for this section`
      : `${label}: ${body()}`;

  return [
    `PERIOD: ${s.from} → ${s.to} (30 days)`,
    s.unreadable.length
      ? `SOURCES UNAVAILABLE: ${s.unreadable.join(", ")}. These sections are missing, not empty. Say so in dataGaps and never describe them as zero, none or absent.`
      : `SOURCES: all seven read successfully`,
    line(
      "profile",
      "SUBJECT",
      () =>
        `age=${age ?? "?"}, gender=${profile?.gender ?? "?"}, height=${profile?.height_cm ?? "?"}cm, goal=${profile?.goal ?? "?"}, experience=${profile?.experience ?? "?"}, limitations=${profile?.limitations ?? "none"}, diet=${profile?.diet ?? "?"}, allergies=${profile?.allergies ?? "none"}`,
    ),
    line(
      "training sessions",
      "TRAINING",
      () =>
        `sessions=${s.sessions}, ${s.sessionsPerWeek}/week, total volume=${s.totalVolumeKg}kg, total time=${s.trainingMinutes}min, avg session=${s.avgSessionMinutes}min`,
    ),
    line("logged sets", "TOP LIFTS", () =>
      s.topLifts.length
        ? s.topLifts.map((l) => `${l.exercise} ${l.bestWeight}kg×${l.reps}`).join("; ")
        : "no logged sets",
    ),
    line(
      "daily check-ins",
      "RECOVERY",
      () =>
        `check-ins=${s.checkins}, avg readiness=${s.avgReadiness ?? "—"}, avg sleep=${s.avgSleepHours ?? "—"}h, soreness=${s.avgSoreness ?? "—"}, stress=${s.avgStress ?? "—"}, energy=${s.avgEnergy ?? "—"}`,
    ),
    // A report a physician reads must not present estimated intake as
    // weighed, and must not guess at the mix either: the counts come from
    // the rows themselves.
    line(
      "nutrition log",
      "NUTRITION",
      () =>
        `(${nutritionProvenanceNote(s.nutritionSources)}) days logged=${s.nutritionDaysLogged}/30, avg ${s.avgKcal ?? "—"} kcal, P${s.avgProtein ?? "—"} C${s.avgCarbs ?? "—"} F${s.avgFat ?? "—"} g/day`,
    ),
    line(
      "body measurements",
      "BODY",
      () =>
        `(${bodyProvenanceNote(s.bodySources)}) weight ${s.weightStartKg ?? "—"}kg → ${s.weightEndKg ?? "—"}kg (Δ ${s.weightDeltaKg ?? "—"}kg), body fat ${s.bodyFatStart ?? "—"}% → ${s.bodyFatEnd ?? "—"}%, target ${profile?.target_weight_kg ?? "—"}kg`,
    ),
    line("supplements", "SUPPLEMENTS", () =>
      s.supplements.length
        ? s.supplements.map((x) => `${x.name} ${x.dose ?? ""} ×${x.timesPerDay ?? 1}`).join("; ")
        : "none",
    ),
  ].join("\n");
}
