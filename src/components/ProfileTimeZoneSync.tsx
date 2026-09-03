import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef } from "react";
import { browserTimeZone } from "@/lib/local-day";
import { syncProfileTimeZone } from "@/lib/profile-time-zone.functions";

function storageKey(userId: string): string {
  return `gymslife:profile-time-zone:${userId}`;
}

function savedTimeZone(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function rememberTimeZone(key: string, timeZone: string): void {
  try {
    window.localStorage.setItem(key, timeZone);
  } catch {
    // Browser storage is only a write-deduplication cache; persistence remains server-owned.
  }
}

/**
 * Keeps the canonical profile's calendar-day boundary aligned with the device.
 * It is deliberately silent: a failure cannot block an authenticated page, and
 * the next normal app visit safely retries it.
 */
export function ProfileTimeZoneSync({ userId }: { userId: string }) {
  const sync = useServerFn(syncProfileTimeZone);
  const attempted = useRef<string | null>(null);

  useEffect(() => {
    const timeZone = browserTimeZone();
    const key = storageKey(userId);
    const attempt = `${userId}:${timeZone}`;

    if (attempted.current === attempt || savedTimeZone(key) === timeZone) return;

    attempted.current = attempt;
    void sync({ data: timeZone })
      .then((result) => rememberTimeZone(key, result.timeZone))
      .catch(() => {
        attempted.current = null;
      });
  }, [sync, userId]);

  return null;
}
