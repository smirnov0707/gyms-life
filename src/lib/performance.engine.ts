export function calculateVolume(reps: number | null, weightKg: number | null): number {
  return Math.max(0, reps ?? 0) * Math.max(0, weightKg ?? 0);
}

export function calculateEstimated1RM(weightKg: number | null, reps: number | null): number | null {
  if (weightKg == null || reps == null || weightKg <= 0 || reps <= 0) return null;
  return Number((weightKg * (1 + reps / 30)).toFixed(1));
}

export function calculateAverage(values: number[]): number | null {
  if (!values.length) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}
