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

function nextDay(day: string): string {
  const parts = dayParts(day);
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  return formatDay(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

/** UTC instants that enclose one calendar day in the supplied IANA zone. */
export function dayBoundsInTimeZone(day: string, timeZone: string): { start: string; end: string } {
  const canonicalDay = IsoDaySchema.parse(day);
  const zone = IanaTimeZoneSchema.parse(timeZone);
  return {
    start: midnightInTimeZone(canonicalDay, zone).toISOString(),
    end: midnightInTimeZone(nextDay(canonicalDay), zone).toISOString(),
  };
}
