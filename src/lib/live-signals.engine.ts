/**
 * Turns the raw health and body rows into the signal rail the athlete reads.
 *
 * Pure and total. Every signal comes back with a state that says what is
 * actually known about it, because the four cases look identical on a
 * dashboard and mean completely different things:
 *
 *  - `measured`   a reading recent enough to act on
 *  - `stale`      the last reading is old; it is shown with its age, never
 *                 presented as today's
 *  - `absent`     nothing has ever recorded this signal
 *  - `unreadable` the source query failed, so we do not know either way
 *
 * The last one is the one dashboards get wrong: a failed read rendered as an
 * empty tile tells the athlete they have no data when in fact nobody looked.
 */

export const LIVE_SIGNAL_IDS = [
  "sleep",
  "hrv",
  "restingHr",
  "steps",
  "activeKcal",
  "weight",
  "bodyFat",
] as const;

export type LiveSignalId = (typeof LIVE_SIGNAL_IDS)[number];
export type LiveSignalState = "measured" | "stale" | "absent" | "unreadable";

export type LiveSignal = {
  id: LiveSignalId;
  state: LiveSignalState;
  /** The reading itself, or null in every state but `measured` and `stale`. */
  value: number | null;
  /** Local day the reading is for, as recorded by its source. */
  recordedOn: string | null;
  /** Whole days between that day and today. Zero means today. */
  ageDays: number | null;
  /**
   * Change against the previous distinct reading, in the signal's own unit.
   * Null when there is only one reading — one point is not a trend, and a
   * dashboard that renders it as "0.0" invents a stable measurement.
   */
  delta: number | null;
  /** What produced the reading: a watch, a phone, or the athlete by hand. */
  source: string | null;
};

/** After this many days a reading describes the past, not the present. */
export const SIGNAL_STALE_AFTER_DAYS = 3;

export type HealthSampleRow = {
  sample_on: string;
  source: string | null;
  resting_hr: number | string | null;
  hrv_ms: number | string | null;
  sleep_hours: number | string | null;
  steps: number | string | null;
  active_kcal: number | string | null;
};

export type BodyMetricRow = {
  measured_on: string;
  weight_kg: number | string | null;
  body_fat: number | string | null;
};

type Reading = { day: string; value: number; source: string | null };

const numeric = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** Whole days from `day` (a YYYY-MM-DD local day) to `today`. */
function daysBetween(day: string, today: string): number | null {
  const from = Date.parse(`${day}T00:00:00Z`);
  const to = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.round((to - from) / 86_400_000);
}

/**
 * Newest first, one reading per day. Duplicate days keep the first row seen,
 * which is why the caller must pass rows already ordered newest first.
 */
function readingsFor(
  rows: readonly { day: string; value: number | null; source: string | null }[],
): Reading[] {
  const byDay = new Map<string, Reading>();
  for (const row of rows) {
    if (row.value === null || byDay.has(row.day)) continue;
    byDay.set(row.day, { day: row.day, value: row.value, source: row.source });
  }
  return [...byDay.values()].sort((left, right) => right.day.localeCompare(left.day));
}

function signalFrom(id: LiveSignalId, readings: Reading[], today: string): LiveSignal {
  const latest = readings[0];
  if (!latest) {
    return {
      id,
      state: "absent",
      value: null,
      recordedOn: null,
      ageDays: null,
      delta: null,
      source: null,
    };
  }
  const ageDays = daysBetween(latest.day, today);
  const previous = readings[1];
  return {
    id,
    state: ageDays !== null && ageDays > SIGNAL_STALE_AFTER_DAYS ? "stale" : "measured",
    value: latest.value,
    recordedOn: latest.day,
    ageDays,
    delta: previous ? round(latest.value - previous.value) : null,
    source: latest.source,
  };
}

/** Two decimals, so a floating-point subtraction does not print as -0.30000000000000004. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function unreadable(id: LiveSignalId): LiveSignal {
  return {
    id,
    state: "unreadable",
    value: null,
    recordedOn: null,
    ageDays: null,
    delta: null,
    source: null,
  };
}

export type LiveSignalsInput = {
  /** Newest first. Null when the query failed rather than returned nothing. */
  health: readonly HealthSampleRow[] | null;
  /** Newest first. Null when the query failed rather than returned nothing. */
  body: readonly BodyMetricRow[] | null;
  /** The athlete's local day, so "today" is theirs and not the server's. */
  today: string;
};

export function buildLiveSignals(input: LiveSignalsInput): LiveSignal[] {
  const { health, body, today } = input;

  const fromHealth = (id: LiveSignalId, pick: (row: HealthSampleRow) => number | null) =>
    health === null
      ? unreadable(id)
      : signalFrom(
          id,
          readingsFor(
            health.map((row) => ({ day: row.sample_on, value: pick(row), source: row.source })),
          ),
          today,
        );

  const fromBody = (id: LiveSignalId, pick: (row: BodyMetricRow) => number | null) =>
    body === null
      ? unreadable(id)
      : signalFrom(
          id,
          readingsFor(
            body.map((row) => ({ day: row.measured_on, value: pick(row), source: "manual" })),
          ),
          today,
        );

  return [
    fromHealth("sleep", (row) => numeric(row.sleep_hours)),
    fromHealth("hrv", (row) => numeric(row.hrv_ms)),
    fromHealth("restingHr", (row) => numeric(row.resting_hr)),
    fromHealth("steps", (row) => numeric(row.steps)),
    fromHealth("activeKcal", (row) => numeric(row.active_kcal)),
    fromBody("weight", (row) => numeric(row.weight_kg)),
    fromBody("bodyFat", (row) => numeric(row.body_fat)),
  ];
}

/**
 * What the rail says about itself as a whole.
 *
 * `connected` counts signals with any reading at all, not recent ones: a watch
 * that stopped syncing last month is still a connected source, and telling the
 * athlete otherwise sends them to set up something they already have.
 */
export function liveSignalsSummary(signals: readonly LiveSignal[]) {
  const measured = signals.filter((signal) => signal.state === "measured").length;
  const stale = signals.filter((signal) => signal.state === "stale").length;
  const unreadable = signals.filter((signal) => signal.state === "unreadable").length;
  return {
    total: signals.length,
    measured,
    stale,
    unreadable,
    connected: measured + stale,
    /** True when nothing has ever arrived and nothing failed to be read. */
    silent: measured + stale === 0 && unreadable === 0,
  };
}
