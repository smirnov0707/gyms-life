/** Client-side persistence for a readiness adjustment; calculation stays shared with the server. */
export { adaptSets, loadModifierFor } from "./readiness.engine";

function todayKey(): string {
  return `gymslife_adapt_${new Date().toISOString().slice(0, 10)}`;
}

/** Returns the load modifier the user applied today, or null. */
export function getAppliedAdaptation(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(todayKey());
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 && value <= 1.2 ? value : null;
}

export function applyAdaptation(modifier: number): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(todayKey(), String(modifier));
  window.dispatchEvent(new CustomEvent("gymslife:adaptation"));
}

export function clearAdaptation(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(todayKey());
  window.dispatchEvent(new CustomEvent("gymslife:adaptation"));
}

/** Suggested load adjusted for fatigue, rounded to 0.5 kg. */
export function adaptWeight(weightKg: number, modifier: number): number {
  return Math.round(weightKg * modifier * 2) / 2;
}
