import { z } from "zod";

/** A real calendar day, independent of a server's own time zone. */
export const IsoDaySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid calendar day.")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Invalid calendar day.");

function isSupportedTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

/**
 * IANA identifiers are sent by the client only to establish a calendar-day
 * boundary. They are validated on the server; browser-supplied user IDs and
 * dates are never trusted for authorization.
 */
export const IanaTimeZoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .refine(isSupportedTimeZone, "Unsupported time zone.");

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDay(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${pad(month)}-${pad(day)}`;
}

function dayParts(day: string): { year: number; month: number; day: number } {
  const parsed = IsoDaySchema.parse(day);
  const [yearText, monthText, dayText] = parsed.split("-");
  return { year: Number(yearText), month: Number(monthText), day: Number(dayText) };
}

function partNumber(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  const part = parts.find((candidate) => candidate.type === type);
  if (!part) throw new Error(`Missing ${type} date-time part.`);
  return Number(part.value);
}

function zonedParts(
  instant: Date,
  timeZone: string,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const zone = IanaTimeZoneSchema.parse(timeZone);
  if (Number.isNaN(instant.getTime())) throw new Error("Invalid instant.");

  const parts = new Intl.DateTimeFormat("en-US-u-ca-iso8601-nu-latn", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);

  return {
    year: partNumber(parts, "year"),
    month: partNumber(parts, "month"),
    day: partNumber(parts, "day"),
    hour: partNumber(parts, "hour"),
    minute: partNumber(parts, "minute"),
    second: partNumber(parts, "second"),
  };
}

/** Returns the caller's calendar day for a concrete instant. */
export function dayInTimeZone(instant: Date, timeZone: string): string {
  const parts = zonedParts(instant, timeZone);
  return formatDay(parts.year, parts.month, parts.day);
}

const WeekdayIndexByEnglishShortName: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Returns the user's local weekday with Sunday as 0. The fixed English locale
 * keeps this mapping stable regardless of the server's locale.
 */
export function weekdayInTimeZone(instant: Date, timeZone: string): number {
  const zone = IanaTimeZoneSchema.parse(timeZone);
  if (Number.isNaN(instant.getTime())) throw new Error("Invalid instant.");

  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    weekday: "short",
  }).format(instant);
  const index = WeekdayIndexByEnglishShortName[weekday];
  if (index === undefined) throw new Error("Unsupported weekday output.");
  return index;
}

/**
 * Returns the local weekday for an ISO calendar day. It deliberately goes
 * through that day's local midnight instead of guessing from a UTC noon,
 * which would shift the day for far-east or far-west time zones.
 */
export function weekdayForDay(day: string, timeZone: string): number {
  const { start } = dayBoundsInTimeZone(day, timeZone);
  return weekdayInTimeZone(new Date(start), timeZone);
}

/** Returns the browser's IANA zone, with UTC as the safe fallback. */
export function browserTimeZone(): string {
  if (typeof window === "undefined" || typeof Intl === "undefined") return "UTC";
  const candidate = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return IanaTimeZoneSchema.safeParse(candidate).success ? candidate : "UTC";
}

function midnightInTimeZone(day: string, timeZone: string): Date {
  const zone = IanaTimeZoneSchema.parse(timeZone);
  const parts = dayParts(day);
  const requestedLocalEpoch = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0);
  let candidateEpoch = requestedLocalEpoch;

  // Convert a wall-clock midnight to an instant. Repeating the offset lookup
  // handles both ordinary offsets and daylight-saving changes without adding a
  // time-zone dependency or relying on the server's locale.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const observed = zonedParts(new Date(candidateEpoch), zone);
    const observedLocalEpoch = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second,
    );
    const nextCandidateEpoch = requestedLocalEpoch - (observedLocalEpoch - candidateEpoch);
    if (nextCandidateEpoch === candidateEpoch) break;
    candidateEpoch = nextCandidateEpoch;
  }

  return new Date(candidateEpoch);
}

/** Moves a canonical calendar day without involving the server's time zone. */
export function dayOffset(day: string, offsetDays: number): string {
  if (!Number.isSafeInteger(offsetDays)) throw new Error("Calendar-day offset must be an integer.");
  const parts = dayParts(day);
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + offsetDays));
  return formatDay(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

/** Returns the number of whole calendar days from `startDay` to `endDay`. */
export function calendarDayDifference(startDay: string, endDay: string): number {
  const start = dayParts(startDay);
  const end = dayParts(endDay);
  const startEpoch = Date.UTC(start.year, start.month - 1, start.day);
  const endEpoch = Date.UTC(end.year, end.month - 1, end.day);
  return Math.round((endEpoch - startEpoch) / 86_400_000);
}

/**
 * Counts consecutive activity days in the caller's calendar. An activity on
 * yesterday starts the streak when none has been recorded today, so a rest
 * morning does not reset an otherwise consecutive training run.
 */
export function calculateConsecutiveCalendarDayStreak(
  timestamps: readonly string[],
  timeZone = "UTC",
  now = new Date(),
): number {
  const zone = IanaTimeZoneSchema.parse(timeZone);
  const activeDays = new Set(
    timestamps.flatMap((timestamp) => {
      const instant = new Date(timestamp);
      return Number.isNaN(instant.getTime()) ? [] : [dayInTimeZone(instant, zone)];
    }),
  );

  let cursorDay = dayInTimeZone(now, zone);
  let streak = 0;

  while (true) {
    if (!activeDays.has(cursorDay)) {
      if (streak === 0) {
        cursorDay = dayOffset(cursorDay, -1);
        if (!activeDays.has(cursorDay)) return 0;
        continue;
      }
      return streak;
    }
    streak += 1;
    cursorDay = dayOffset(cursorDay, -1);
  }
}

/**
 * Checks a date-only fact against a user's calendar day. Date-only rows such
 * as readiness and nutrition logs must not be compared to a UTC instant.
 */
export function isDayWithinPastDays(day: string, days: number, today: string): boolean {
  if (!Number.isSafeInteger(days) || days < 0) {
    throw new Error("Calendar-day window must be a non-negative integer.");
  }
  const value = dayParts(day);
  const current = dayParts(today);
  const valueEpoch = Date.UTC(value.year, value.month - 1, value.day);
  const currentEpoch = Date.UTC(current.year, current.month - 1, current.day);
  const difference = Math.round((currentEpoch - valueEpoch) / 86_400_000);
  return difference >= 0 && difference <= days;
}

/** UTC instants that enclose one calendar day in the supplied IANA zone. */
export function dayBoundsInTimeZone(day: string, timeZone: string): { start: string; end: string } {
  const canonicalDay = IsoDaySchema.parse(day);
  const zone = IanaTimeZoneSchema.parse(timeZone);
  return {
    start: midnightInTimeZone(canonicalDay, zone).toISOString(),
    end: midnightInTimeZone(dayOffset(canonicalDay, 1), zone).toISOString(),
  };
}
