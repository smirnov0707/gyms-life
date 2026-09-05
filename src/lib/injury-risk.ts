// Real injury-risk model built from the user's own logged training data.
// No simulated numbers: every factor is derived from set_logs, sessions and check-ins.

import type { TKey } from "./i18n";

export interface RiskSetRow {
  /**
   * When the set was performed, not when its row was written. The acute
   * window below is a workload spike detector: dating offline-synced sets
   * to their arrival bunches them onto one day and manufactures a spike
   * that never happened.
   */
  performed_at: string;
  exercise_slug: string;
  exercise_name: string;
  weight_kg: number | null;
  reps: number | null;
}

export interface RiskSessionRow {
  started_at: string;
  total_volume: number | null;
}

export interface RiskCheckinRow {
  checkin_on: string;
  soreness: number | null;
  readiness_score: number | null;
}

export type RiskLevel = "low" | "moderate" | "high";
type RiskTranslationKey = Extract<TKey, `nx.risk.${string}`>;

export interface RiskFactor {
  /** i18n key for the factor label */
  key: RiskTranslationKey;
  /** short value shown to the user, already formatted */
  value: string;
  level: RiskLevel;
  /** i18n key for the one-line advice */
  adviceKey: RiskTranslationKey;
}

export interface RiskReport {
  score: number; // 0 = safest, 100 = highest risk
  level: RiskLevel;
  factors: RiskFactor[];
  /**
   * Factors this history could not support, by the same key the assessed
   * ones use. The score is additive over the five factors below, so an
   * athlete with no check-ins scores lower than one who logs them — not
   * because they are safer, but because a whole term is missing. Naming
   * the gap is the difference between a low score and a low score we can
   * stand behind.
   */
  unassessed: RiskTranslationKey[];
  hasData: boolean;
}

const DAY = 86_400_000;

/**
 * Where the score stops being called low, and where it starts being called
 * high. Exported so the panel can mark the same boundaries on its scale
 * instead of hardcoding a second copy of them.
 */
export const RISK_MODERATE_AT = 30;
export const RISK_HIGH_AT = 55;

const PUSH = /bench|press|push|dip|fly|tricep|chest|shoulder|overhead|krut|spaud/i;
const PULL = /row|pull|chin|lat|curl|face|shrug|back|deadlift|trauk|nugar/i;
const LEGS = /squat|lunge|leg|glute|hip|calf|thrust|step|prisead|koj/i;

function volume(rows: RiskSetRow[]): number {
  return rows.reduce((n, r) => n + (r.weight_kg ?? 0) * (r.reps ?? 0), 0);
}

function within(rows: RiskSetRow[], from: number, to: number): RiskSetRow[] {
  return rows.filter((r) => {
    const t = new Date(r.performed_at).getTime();
    return t >= from && t < to;
  });
}

function levelOf(v: number, warn: number, bad: number): RiskLevel {
  if (v >= bad) return "high";
  if (v >= warn) return "moderate";
  return "low";
}

export function buildRiskReport(
  sets: RiskSetRow[],
  sessions: RiskSessionRow[],
  checkins: RiskCheckinRow[],
  now = Date.now(),
): RiskReport {
  const factors: RiskFactor[] = [];
  const unassessed: RiskTranslationKey[] = [];
  let risk = 0;

  const hasData = sets.length > 0 || sessions.length > 0;

  /* 1. Acute : chronic workload ratio -------------------------------- */
  const acute = volume(within(sets, now - 7 * DAY, now + DAY));
  const prev3 = volume(within(sets, now - 28 * DAY, now - 7 * DAY)) / 3;
  const acwr = prev3 > 0 ? acute / prev3 : acute > 0 ? 1 : 0;
  if (prev3 > 0) {
    const over = Math.max(0, acwr - 1.3);
    const under = acwr < 0.7 ? 0.7 - acwr : 0;
    const add = Math.min(35, over * 55 + under * 25);
    risk += add;
    factors.push({
      key: "nx.risk.acwr",
      value: `${acwr.toFixed(2)}×`,
      level: acwr > 1.5 ? "high" : acwr > 1.3 || acwr < 0.7 ? "moderate" : "low",
      adviceKey:
        acwr > 1.5
          ? "nx.risk.acwr.high"
          : acwr > 1.3
            ? "nx.risk.acwr.warn"
            : acwr < 0.7
              ? "nx.risk.acwr.low"
              : "nx.risk.acwr.ok",
    });
  } else {
    unassessed.push("nx.risk.acwr");
  }

  /* 2. Push / pull balance ------------------------------------------ */
  const recent = within(sets, now - 21 * DAY, now + DAY);
  const push = volume(recent.filter((r) => PUSH.test(`${r.exercise_slug} ${r.exercise_name}`)));
  const pull = volume(recent.filter((r) => PULL.test(`${r.exercise_slug} ${r.exercise_name}`)));
  if (push + pull > 0) {
    const ratio = pull > 0 ? push / pull : 3;
    const dev = Math.abs(Math.log(Math.max(ratio, 0.05)));
    const add = Math.min(25, dev * 22);
    risk += add;
    factors.push({
      key: "nx.risk.balance",
      value: `${Math.round(ratio * 100) / 100} : 1`,
      level: levelOf(dev, 0.4, 0.8),
      adviceKey:
        dev < 0.4
          ? "nx.risk.balance.ok"
          : ratio > 1
            ? "nx.risk.balance.push"
            : "nx.risk.balance.pull",
    });
  } else {
    unassessed.push("nx.risk.balance");
  }

  /* 3. Recovery days -------------------------------------------------- */
  const days = [...new Set(sessions.map((s) => new Date(s.started_at).toDateString()))]
    .map((d) => new Date(d).getTime())
    .sort((a, b) => b - a);
  let streak = 0;
  for (let i = 0; i < days.length; i++) {
    if (i === 0 && now - days[i]! > 2 * DAY) break;
    if (i > 0 && days[i - 1]! - days[i]! > 1.5 * DAY) break;
    streak++;
  }
  const last14 = days.filter((d) => d > now - 14 * DAY).length;
  if (days.length) {
    const add = Math.min(20, Math.max(0, streak - 3) * 7 + Math.max(0, last14 - 10) * 4);
    risk += add;
    factors.push({
      key: "nx.risk.recovery",
      value: `${streak} / ${last14}`,
      level: levelOf(streak, 4, 6),
      adviceKey:
        streak >= 6
          ? "nx.risk.recovery.high"
          : streak >= 4
            ? "nx.risk.recovery.warn"
            : "nx.risk.recovery.ok",
    });
  } else {
    unassessed.push("nx.risk.recovery");
  }

  /* 4. Soreness & readiness ------------------------------------------ */
  const fresh = checkins.filter((c) => new Date(c.checkin_on).getTime() > now - 10 * DAY);
  if (fresh.length) {
    const soreness =
      fresh.reduce((n, c) => n + (c.soreness ?? 0), 0) /
      Math.max(1, fresh.filter((c) => c.soreness != null).length);
    const readinessVals = fresh.map((c) => c.readiness_score).filter((v): v is number => v != null);
    const readiness = readinessVals.length
      ? readinessVals.reduce((n, v) => n + v, 0) / readinessVals.length
      : null;
    const add = Math.min(
      20,
      Math.max(0, soreness - 2.5) * 8 + (readiness != null ? Math.max(0, 65 - readiness) / 3 : 0),
    );
    risk += add;
    factors.push({
      key: "nx.risk.readiness",
      value: readiness != null ? `${Math.round(readiness)} / 100` : `${soreness.toFixed(1)} / 5`,
      level: levelOf(add, 6, 13),
      adviceKey:
        add >= 13
          ? "nx.risk.readiness.high"
          : add >= 6
            ? "nx.risk.readiness.warn"
            : "nx.risk.readiness.ok",
    });
  } else {
    unassessed.push("nx.risk.readiness");
  }

  /* 5. Fast load jumps on a single lift ------------------------------- */
  const bySlug = new Map<string, RiskSetRow[]>();
  for (const r of recent) {
    const list = bySlug.get(r.exercise_slug) ?? [];
    list.push(r);
    bySlug.set(r.exercise_slug, list);
  }
  let worstJump = 0;
  let worstName = "";
  for (const [, rows] of bySlug) {
    const sorted = [...rows].sort(
      (a, b) => new Date(a.performed_at).getTime() - new Date(b.performed_at).getTime(),
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (!first?.weight_kg || !last?.weight_kg || sorted.length < 4) continue;
    const jump = (last.weight_kg - first.weight_kg) / first.weight_kg;
    if (jump > worstJump) {
      worstJump = jump;
      worstName = last.exercise_name;
    }
  }
  if (worstJump > 0) {
    const add = Math.min(15, Math.max(0, worstJump - 0.1) * 60);
    risk += add;
    factors.push({
      key: "nx.risk.jump",
      value: `${worstName} +${Math.round(worstJump * 100)}%`,
      level: levelOf(worstJump, 0.15, 0.25),
      adviceKey:
        worstJump > 0.25
          ? "nx.risk.jump.high"
          : worstJump > 0.15
            ? "nx.risk.jump.warn"
            : "nx.risk.jump.ok",
    });
  } else {
    unassessed.push("nx.risk.jump");
  }

  const score = Math.max(0, Math.min(100, Math.round(risk)));
  return {
    score,
    level: score >= RISK_HIGH_AT ? "high" : score >= RISK_MODERATE_AT ? "moderate" : "low",
    factors,
    unassessed,
    hasData,
  };
}
