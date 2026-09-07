/**
 * Readiness from wearable data, and the honest limits on saying it.
 *
 * This is the app's own version of the template's "Muscle Readiness 78%". The
 * number is a weighted average of five components, and three things about that
 * average had to change before it could be shown to anyone:
 *
 * - It used to normalise by whatever inputs happened to arrive, so a payload
 *   carrying nothing but a step count produced a readiness score, and a
 *   payload carrying nothing at all produced zero — the worst possible
 *   reading, presented as a measurement, to an athlete who had simply never
 *   connected a watch.
 * - The two components that compare against a baseline used to fall back to
 *   comparing a reading against itself. That is not a neutral result: a first
 *   HRV reading scored 60% of its component and a first resting heart rate
 *   scored 83% of its, from nothing. Two of the three heaviest components
 *   manufactured a confident middle value out of a single reading.
 * - The score feeds `healthLoadModifier`, which changes how much work the
 *   athlete is prescribed. A step count alone used to cut the day's load by a
 *   fifth, and no data at all by a third.
 *
 * So a component counts only when it was actually measured against something,
 * the score is withheld unless the components that did count carry enough of
 * the model's weight between them (see `READINESS_MINIMUM_COVERAGE`), and a
 * withheld score changes nothing about the training plan.
 */

export type HealthInput = {
  restingHr: number | null;
  hrvMs: number | null;
  sleepHours: number | null;
  sleepQuality: number | null;
  steps: number | null;
  activeKcal: number | null;
};

export type Baseline = {
  restingHr: number | null;
  hrvMs: number | null;
};

export type ReadinessComponent =
  "sleep_duration" | "sleep_quality" | "hrv" | "resting_hr" | "activity";

/** What each component is worth. They sum to 100. */
export const READINESS_WEIGHTS: Record<ReadinessComponent, number> = {
  sleep_duration: 30,
  sleep_quality: 15,
  hrv: 30,
  resting_hr: 20,
  activity: 5,
};

const TOTAL_WEIGHT = 100;

/**
 * How much of the model must have actually been measured before a score is
 * worth stating.
 *
 * Deliberate and user-visible, like the fatigue decay constant. 45 is the line
 * because of what it admits and what it turns away, not because it is a round
 * number: it takes both sleep components together (30 + 15), or an autonomic
 * signal paired with anything else, and it turns away every single-signal
 * score — sleep duration alone at 30, sleep quality at 15, a step count at 5.
 *
 * Half the weight was the first choice and it was wrong. It rejected sleep
 * duration and quality together, which is a real readiness signal, while
 * accepting the same pair plus a step count — so the one component that
 * carries almost no information was what unlocked the score.
 */
export const READINESS_MINIMUM_COVERAGE = 45;

export type ReadinessScore = {
  /** 0-100. */
  score: number;
  /** The weight actually measured, out of 100. Never below the minimum. */
  coverage: number;
  /** Which components the score rests on, in weight order. */
  measured: ReadinessComponent[];
};

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

/**
 * Deterministic readiness (0-100), or null when too little was measured to
 * say anything.
 *
 * Null is not zero. An athlete with no wearable has not been measured as
 * unrecovered; nothing has been measured at all, and the two must never
 * render the same.
 */
export function recoveryScore(input: HealthInput, baseline: Baseline): ReadinessScore | null {
  let total = 0;
  let weight = 0;
  const measured: ReadinessComponent[] = [];

  const count = (component: ReadinessComponent, fraction: number) => {
    const points = READINESS_WEIGHTS[component];
    total += clamp(fraction, 0, 1) * points;
    weight += points;
    measured.push(component);
  };

  if (input.sleepHours != null) {
    count("sleep_duration", (input.sleepHours - 4) / 4);
  }
  if (input.sleepQuality != null) {
    count("sleep_quality", (clamp(input.sleepQuality, 1, 5) - 1) / 4);
  }
  // HRV and resting heart rate mean something only against this athlete's own
  // baseline. Comparing a reading against itself is not a neutral result — it
  // lands mid-scale and looks like a finding — so with no baseline the
  // component is simply not measured.
  if (input.hrvMs != null && baseline.hrvMs != null && baseline.hrvMs > 0) {
    count("hrv", (input.hrvMs / baseline.hrvMs - 0.7) / 0.5);
  }
  if (input.restingHr != null && baseline.restingHr != null && baseline.restingHr > 0) {
    // Higher than baseline is worse.
    count("resting_hr", 1 - (input.restingHr - baseline.restingHr + 2) / 12);
  }
  if (input.steps != null || input.activeKcal != null) {
    count("activity", 1 - clamp((input.steps ?? 0) / 15000, 0, 1));
  }

  if (weight < READINESS_MINIMUM_COVERAGE) return null;

  return {
    score: Math.round((total / weight) * 100),
    coverage: weight,
    measured: measured.sort((left, right) => READINESS_WEIGHTS[right] - READINESS_WEIGHTS[left]),
  };
}

/**
 * How much of the day's planned work to prescribe, given readiness.
 *
 * A withheld score leaves the plan alone. Anything else would let an absence
 * of measurement quietly cut someone's training — which is exactly what the
 * old zero-for-no-data did, at a third off the day.
 */
export function healthLoadModifier(score: number | null): number {
  if (score === null || !Number.isFinite(score)) return 1;
  if (score >= 85) return 1.05;
  if (score >= 70) return 1;
  if (score >= 55) return 0.9;
  if (score >= 40) return 0.8;
  return 0.65;
}

/** The share of the model behind a score, for copy that has to state it. */
export function readinessCoverageFraction(readiness: ReadinessScore): number {
  return readiness.coverage / TOTAL_WEIGHT;
}
