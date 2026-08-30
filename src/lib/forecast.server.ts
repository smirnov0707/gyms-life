export interface HistRow {
  created_at: string;
  exercise_slug: string;
  exercise_name: string;
  weight_kg: number | null;
  reps: number | null;
  rpe?: number | null;
}

export interface LiftHistory {
  name: string;
  slug: string;
  sessions: number;
  weeksTracked: number;
  best: { weight: number; reps: number; e1rm: number; on: string };
  recent: { on: string; weight: number; reps: number }[];
  weeklyE1rm: { week: string; e1rm: number }[];
}

const epley = (w: number, r: number) => Math.round(w * (1 + r / 30) * 10) / 10;

function weekKey(iso: string) {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

/** Condenses raw set logs into a compact per-lift history the model can reason about. */
export function buildLiftHistory(rows: HistRow[], maxLifts = 6): LiftHistory[] {
  const bySlug = new Map<string, HistRow[]>();
  for (const r of rows) {
    const list = bySlug.get(r.exercise_slug) ?? [];
    list.push(r);
    bySlug.set(r.exercise_slug, list);
  }

  const lifts: LiftHistory[] = [];
  for (const [slug, list] of bySlug) {
    if (list.length < 3) continue;
    const weeks = new Map<string, number>();
    let best = { weight: 0, reps: 0, e1rm: 0, on: "" };
    for (const r of list) {
      const w = r.weight_kg ?? 0;
      const reps = r.reps ?? 0;
      const e = epley(w, reps);
      const k = weekKey(r.created_at);
      if (e > (weeks.get(k) ?? 0)) weeks.set(k, e);
      if (e > best.e1rm) best = { weight: w, reps, e1rm: e, on: r.created_at.slice(0, 10) };
    }
    const weekly = [...weeks.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, e1rm]) => ({ week, e1rm }));
    lifts.push({
      name: list[list.length - 1]!.exercise_name,
      slug,
      sessions: new Set(list.map((r) => r.created_at.slice(0, 10))).size,
      weeksTracked: weekly.length,
      best,
      recent: list.slice(-6).map((r) => ({
        on: r.created_at.slice(0, 10),
        weight: r.weight_kg ?? 0,
        reps: r.reps ?? 0,
      })),
      weeklyE1rm: weekly.slice(-12),
    });
  }

  return lifts.sort((a, b) => b.sessions - a.sessions).slice(0, maxLifts);
}
