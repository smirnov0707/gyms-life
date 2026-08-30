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

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

/**
 * Deterministic recovery score (0-100) from wearable data.
 * Weights: sleep duration 30, sleep quality 15, HRV vs baseline 30, RHR vs baseline 20, activity balance 5.
 */
export function recoveryScore(input: HealthInput, baseline: Baseline): number {
  let total = 0;
  let weight = 0;

  if (input.sleepHours != null) {
    const pts = clamp((input.sleepHours - 4) / 4, 0, 1) * 30;
    total += pts;
    weight += 30;
  }
  if (input.sleepQuality != null) {
    total += ((clamp(input.sleepQuality, 1, 5) - 1) / 4) * 15;
    weight += 15;
  }
  if (input.hrvMs != null) {
    const base = baseline.hrvMs ?? input.hrvMs;
    const ratio = base > 0 ? input.hrvMs / base : 1;
    total += clamp((ratio - 0.7) / 0.5, 0, 1) * 30;
    weight += 30;
  }
  if (input.restingHr != null) {
    const base = baseline.restingHr ?? input.restingHr;
    const delta = input.restingHr - base; // higher than baseline = worse
    total += clamp(1 - (delta + 2) / 12, 0, 1) * 20;
    weight += 20;
  }
  if (input.steps != null || input.activeKcal != null) {
    const steps = input.steps ?? 0;
    const load = clamp(steps / 15000, 0, 1);
    total += (1 - load) * 5;
    weight += 5;
  }

  if (weight === 0) return 0;
  return Math.round((total / weight) * 100);
}

export function healthLoadModifier(score: number) {
  if (score >= 85) return 1.05;
  if (score >= 70) return 1;
  if (score >= 55) return 0.9;
  if (score >= 40) return 0.8;
  return 0.65;
}
