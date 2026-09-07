/**
 * Normalizes health payloads coming from phone automations (Apple Shortcuts,
 * Health Connect, Tasker...). Those tools send locale-formatted strings,
 * mixed units (minutes vs hours, seconds vs milliseconds, kJ vs kcal) and
 * a variety of field names, which is why raw values looked wrong before.
 */

/**
 * How the night was spent, in minutes, exactly as the source reported it.
 *
 * Null means the source said nothing about that stage. Zero would be a claim —
 * "you were never awake", "you got no deep sleep" — and no source that omits
 * stages is making it.
 */
export type SleepStages = {
  awakeMinutes: number | null;
  remMinutes: number | null;
  deepMinutes: number | null;
  coreMinutes: number | null;
};

export type NormalizedHealth = {
  restingHr: number | null;
  hrvMs: number | null;
  sleepHours: number | null;
  sleepQuality: number | null;
  steps: number | null;
  activeKcal: number | null;
  vo2max: number | null;
  sleepStages: SleepStages;
  /**
   * True when stages arrived but could not stand beside the sleep duration
   * they were sent with, and were dropped rather than stored.
   *
   * The rest of the sample is kept: a broken stage field is no reason to lose
   * the heart rate that came with it. The flag exists so the endpoint can say
   * out loud that something was dropped — an automation whose units are wrong
   * has no other way of finding out.
   */
  sleepStagesRejected: boolean;
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
  s = s.replace(/[^\d,.-]/g, "");
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

/**
 * The first key that carried anything, together with the value.
 *
 * The key is returned as well as the value because for durations the name is
 * where the unit lives: `rem_minutes` and `rem_hours` are the same number
 * meaning different things, and guessing between them puts a wrong hypnogram
 * in front of the athlete.
 */
const pickEntry = (raw: Raw, keys: string[]): { key: string; value: unknown } | undefined => {
  const lower: Raw = {};
  for (const [k, v] of Object.entries(raw)) lower[k.toLowerCase().replace(/[\s-]+/g, "_")] = v;
  for (const k of keys) {
    const v = lower[k];
    if (v !== undefined && v !== null && v !== "") return { key: k, value: v };
  }
  return undefined;
};

const pick = (raw: Raw, keys: string[]): unknown => pickEntry(raw, keys)?.value;

const inRange = (n: number | null, min: number, max: number) =>
  n != null && n >= min && n <= max ? n : null;

const round = (n: number | null, d = 1) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);

/** Every spelling of one stage, explicit units first so the name settles them. */
const STAGE_KEYS = {
  awake: [
    "sleep_awake_minutes",
    "awake_minutes",
    "sleep_awake_hours",
    "awake_hours",
    "awake_mins",
    "awake_min",
    "awake_seconds",
    "wake_minutes",
    "time_awake",
    "awake_time",
    "sleep_awake",
    "awake",
  ],
  rem: [
    "sleep_rem_minutes",
    "rem_minutes",
    "rem_sleep_minutes",
    "sleep_rem_hours",
    "rem_hours",
    "rem_mins",
    "rem_min",
    "rem_seconds",
    "rem_sleep",
    "sleep_rem",
    "rem",
  ],
  deep: [
    "sleep_deep_minutes",
    "deep_minutes",
    "deep_sleep_minutes",
    "slow_wave_minutes",
    "sleep_deep_hours",
    "deep_hours",
    "deep_mins",
    "deep_min",
    "deep_seconds",
    "deep_sleep",
    "sleep_deep",
    "deep",
  ],
  core: [
    "sleep_core_minutes",
    "core_minutes",
    "core_sleep_minutes",
    "light_minutes",
    "light_sleep_minutes",
    "sleep_core_hours",
    "core_hours",
    "light_hours",
    "core_mins",
    "core_min",
    "core_seconds",
    "core_sleep",
    "sleep_core",
    "light_sleep",
    "sleep_light",
    "core",
    "light",
  ],
} as const;

const HOUR_KEY = /_(?:hours|hrs)$/;
const SECOND_KEY = /_(?:seconds|secs)$/;
const HOUR_WORD = /\b(?:h|hr|hrs|hour|hours|val|std)\b/i;
const SECOND_WORD = /\b(?:s|sec|secs|second|seconds)\b/i;

/**
 * One stage, in minutes, from whatever shape it arrived in.
 *
 * Sources report stage durations in minutes, in hours, in seconds, and as
 * "1h 20m". A bare number is read as minutes, because that is what every
 * source that reports stages at all reports them in; above a day it cannot be
 * minutes, so it is read as seconds.
 */
function stageMinutes(raw: Raw, keys: readonly string[]): number | null {
  const found = pickEntry(raw, [...keys]);
  if (!found) return null;
  const text = typeof found.value === "string" ? found.value : "";

  // "1:20" and "1h 20m" carry both halves and are read whole rather than
  // through the unit rules below.
  const clock = text.match(/^\s*(\d{1,2}):(\d{2})\s*$/);
  if (clock) return inRange(Number(clock[1]) * 60 + Number(clock[2]), 0, 1440);
  const hm = text.match(
    /^\s*(\d+)\s*(?:h|hr|hrs|hour|hours|val|std)\s*(\d+)?\s*(?:m|min|mins|minutes)?\s*$/i,
  );
  if (hm) return inRange(Number(hm[1]) * 60 + Number(hm[2] ?? 0), 0, 1440);

  const n = toNumber(found.value);
  if (n == null) return null;
  const hours = HOUR_KEY.test(found.key) || HOUR_WORD.test(text);
  const seconds = SECOND_KEY.test(found.key) || SECOND_WORD.test(text);
  const minutes = hours ? n * 60 : seconds ? n / 60 : n > 1440 ? n / 60 : n;
  return inRange(round(minutes), 0, 1440);
}

/**
 * How far the staged sleep may exceed the reported sleep duration before the
 * two are treated as contradicting each other.
 *
 * Stages and totals come from the same source but are rounded separately, so
 * they never agree exactly. The slack is wide enough for that rounding and far
 * too narrow to hide a unit error, which is what this is here to catch: stages
 * sent in seconds and read as minutes miss by sixtyfold, not by a tenth.
 */
export const STAGE_TOTAL_TOLERANCE = 1.1;
export const STAGE_TOTAL_SLACK_MINUTES = 15;

const NO_STAGES: SleepStages = {
  awakeMinutes: null,
  remMinutes: null,
  deepMinutes: null,
  coreMinutes: null,
};

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

  // Stages. Note what is deliberately *not* done here: sleepHours is never
  // derived from rem + deep + core, even though that sum is what "time asleep"
  // means. A derived duration stored in the same column as a reported one is
  // indistinguishable from it afterwards, and nothing downstream could tell
  // the athlete which they were looking at.
  const stages: SleepStages = {
    awakeMinutes: stageMinutes(raw, STAGE_KEYS.awake),
    remMinutes: stageMinutes(raw, STAGE_KEYS.rem),
    deepMinutes: stageMinutes(raw, STAGE_KEYS.deep),
    coreMinutes: stageMinutes(raw, STAGE_KEYS.core),
  };
  const reported = Object.values(stages).some((value) => value !== null);
  const asleep = (stages.remMinutes ?? 0) + (stages.deepMinutes ?? 0) + (stages.coreMinutes ?? 0);
  const wholeNight = asleep + (stages.awakeMinutes ?? 0);
  // Stages that add up to more sleep than the source itself reported are not
  // a hypnogram, they are a unit error. Storing them would draw a night that
  // never happened, so the whole set goes rather than the part that overflows:
  // there is no way to tell which of the four is the wrong one.
  const contradictsDuration =
    sleepHours !== null &&
    asleep > sleepHours * 60 * STAGE_TOTAL_TOLERANCE + STAGE_TOTAL_SLACK_MINUTES;
  const sleepStagesRejected = reported && (contradictsDuration || wholeNight > 1440);

  return {
    restingHr: round(restingHr),
    hrvMs: round(hrvMs),
    sleepHours,
    sleepQuality: sleepQuality == null ? null : Math.round(sleepQuality),
    steps: steps == null ? null : Math.round(steps),
    activeKcal,
    vo2max: round(vo2max),
    sleepStages: sleepStagesRejected ? NO_STAGES : stages,
    sleepStagesRejected,
  };
}

/** Extracts a YYYY-MM-DD date from many shapes ("2026-08-28T06:00:00Z", "28/08/2026"). */
/** True only for a day that exists: rejects 2026-13-45 and 2025-02-30 alike. */
function realDay(day: string): boolean {
  const parsed = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day;
}

export function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  // Each branch is checked against the calendar before it is returned. The
  // first two used to hand their capture groups straight back, so "2026-13-45"
  // travelled all the way to Postgres and came back as a write failure the
  // athlete was told was a temporary outage.
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const day = `${iso[1]}-${iso[2]}-${iso[3]}`;
    return realDay(day) ? day : null;
  }
  const dmy = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (dmy) {
    const day = `${dmy[3]}-${dmy[2]!.padStart(2, "0")}-${dmy[1]!.padStart(2, "0")}`;
    return realDay(day) ? day : null;
  }
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

/**
 * How far back a phone may date a sample it is only now managing to send.
 * Long enough for a holiday with no signal, short enough that a shortcut with
 * the wrong date format cannot quietly rewrite a year of history.
 */
export const SAMPLE_BACKFILL_DAYS = 90;

/**
 * One day of slack forward, because a profile whose time zone is wrong or
 * stale will legitimately send a day that is still tomorrow on the server.
 */
export const SAMPLE_FORWARD_DAYS = 1;

/**
 * Whether a sample may be filed against `day`, given the athlete's own today.
 *
 * Out-of-window samples are refused rather than moved: silently filing
 * someone's reading under a different day makes the history wrong in a way
 * nothing downstream can detect, and the athlete is never told.
 */
export function sampleDateWithinWindow(day: string, athleteToday: string): boolean {
  if (!realDay(day) || !realDay(athleteToday)) return false;
  const distance =
    (Date.parse(`${athleteToday}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86_400_000;
  return distance <= SAMPLE_BACKFILL_DAYS && distance >= -SAMPLE_FORWARD_DAYS;
}
