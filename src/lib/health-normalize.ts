/**
 * Normalizes health payloads coming from phone automations (Apple Shortcuts,
 * Health Connect, Tasker...). Those tools send locale-formatted strings,
 * mixed units (minutes vs hours, seconds vs milliseconds, kJ vs kcal) and
 * a variety of field names, which is why raw values looked wrong before.
 */

export type NormalizedHealth = {
  restingHr: number | null;
  hrvMs: number | null;
  sleepHours: number | null;
  sleepQuality: number | null;
  steps: number | null;
  activeKcal: number | null;
  vo2max: number | null;
};

type Raw = Record<string, unknown>;

/** Accepts 9800, "9 800", "9,800", "9.800 steps", "7,4" etc. */
export function toNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  let s = value.trim();
  if (!s) return null;
  // strip everything but digits, separators and sign
  s = s.replace(/[^\d,.\-]/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // the right-most separator is the decimal one, the other is a grouping mark
    const dec = Math.max(lastComma, lastDot);
    s = s.slice(0, dec).replace(/[.,]/g, "") + "." + s.slice(dec + 1);
  } else if (lastComma > -1) {
    const frac = s.length - lastComma - 1;
    s = frac === 3 ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (lastDot > -1) {
    const frac = s.length - lastDot - 1;
    if (frac === 3 && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const pick = (raw: Raw, keys: string[]): unknown => {
  const lower: Raw = {};
  for (const [k, v] of Object.entries(raw)) lower[k.toLowerCase().replace(/[\s-]+/g, "_")] = v;
  for (const k of keys) {
    const v = lower[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
};

const inRange = (n: number | null, min: number, max: number) =>
  n != null && n >= min && n <= max ? n : null;

const round = (n: number | null, d = 1) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);

export function normalizeHealthPayload(raw: Raw): NormalizedHealth {
  // Resting heart rate — bpm
  const restingHr = inRange(
    toNumber(pick(raw, ["resting_hr", "resting_heart_rate", "restinghr", "rhr", "heart_rate"])),
    25,
    150,
  );

  // HRV — Apple sends ms, Shortcuts sometimes seconds (0.078)
  let hrv = toNumber(pick(raw, ["hrv_ms", "hrv", "heart_rate_variability", "sdnn", "hrv_sdnn"]));
  if (hrv != null && hrv > 0 && hrv < 1) hrv = hrv * 1000;
  const hrvMs = inRange(hrv, 5, 400);

  // Sleep — hours, minutes, seconds or "7h 24m" depending on the source
  const sleepRaw = pick(raw, ["sleep_hours", "sleep", "sleep_duration", "asleep", "time_asleep"]);
  let sleep: number | null = null;
  if (typeof sleepRaw === "string") {
    const hm = sleepRaw.match(/(\d+)\s*(?:h|val|std|ч)[^\d]*(\d+)?/i);
    const clock = sleepRaw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (clock) sleep = Number(clock[1]) + Number(clock[2]) / 60;
    else if (hm) sleep = Number(hm[1]) + Number(hm[2] ?? 0) / 60;
  }
  if (sleep == null) sleep = toNumber(sleepRaw);
  const sleepMinutes = toNumber(pick(raw, ["sleep_minutes", "sleep_mins", "asleep_minutes"]));
  if (sleep == null && sleepMinutes != null) sleep = sleepMinutes / 60;
  if (sleep != null) {
    if (sleep > 1440)
      sleep = sleep / 3600; // seconds
    else if (sleep > 20) sleep = sleep / 60; // minutes
  }
  const sleepHours = inRange(round(sleep), 0, 20);

  const sleepQuality = inRange(
    toNumber(pick(raw, ["sleep_quality", "quality", "sleep_score"])),
    1,
    5,
  );

  // Steps
  const steps = inRange(
    toNumber(pick(raw, ["steps", "step_count", "steps_today", "daily_steps"])),
    0,
    200000,
  );

  // Active energy — kcal, or kJ from some Android/Garmin/Apple exports
  const energyRaw = pick(raw, [
    "active_kcal",
    "active_calories",
    "active_energy",
    "calories",
    "kcal",
    "energy",
  ]);
  let kcal = toNumber(energyRaw);
  if (kcal != null && typeof energyRaw === "string" && /kj|kilojoul/i.test(energyRaw)) {
    kcal = kcal / 4.184;
  }
  const kj = toNumber(pick(raw, ["active_kj", "kilojoules", "kj"]));
  if (kcal == null && kj != null) kcal = kj / 4.184;
  // A value in kJ accidentally sent as kcal (> 8000 kcal/day is implausible)
  if (kcal != null && kcal > 8000) kcal = kcal / 4.184;
  const activeKcal = inRange(kcal == null ? null : Math.round(kcal), 0, 20000);

  const vo2max = inRange(toNumber(pick(raw, ["vo2max", "vo2_max", "vo2"])), 10, 100);

  return {
    restingHr: round(restingHr),
    hrvMs: round(hrvMs),
    sleepHours,
    sleepQuality: sleepQuality == null ? null : Math.round(sleepQuality),
    steps: steps == null ? null : Math.round(steps),
    activeKcal,
    vo2max: round(vo2max),
  };
}

/** Extracts a YYYY-MM-DD date from many shapes ("2026-08-28T06:00:00Z", "28/08/2026"). */
export function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2]!.padStart(2, "0")}-${dmy[1]!.padStart(2, "0")}`;
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}
