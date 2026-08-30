export function tactileClick(pattern: number | number[] = 12) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

export function withTactile<T extends (...args: unknown[]) => void>(
  fn: T,
  pattern: number | number[] = 12,
): T {
  return ((...args: unknown[]) => {
    tactileClick(pattern);
    return fn(...args);
  }) as T;
}
