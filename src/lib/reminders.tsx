import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { useI18n, tr, type Lang } from "./i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth";
import { clearHydrationToday, getHydrationIntake, logHydration } from "./hydration.functions";
import { browserTimeZone, dayInTimeZone } from "./local-day";
import { purgeLegacyAdaptationKeys } from "./readiness-adapt";

export type ReminderKind = "water" | "meal" | "workout";

export type ReminderSettings = {
  enabled: boolean;
  /** Browser notifications in addition to in-app toasts. */
  push: boolean;
  sound: boolean;
  water: { on: boolean; from: string; to: string; everyMin: number; targetMl: number; ml: number };
  meal: { on: boolean; times: string[] };
  workout: { on: boolean; time: string; days: number[] };
};

export const DEFAULT_REMINDERS: ReminderSettings = {
  enabled: true,
  push: false,
  sound: true,
  water: { on: true, from: "08:00", to: "21:00", everyMin: 120, targetMl: 2500, ml: 300 },
  meal: { on: true, times: ["08:00", "12:30", "16:00", "19:30"] },
  workout: { on: true, time: "18:00", days: [1, 2, 3, 4, 5] },
};

const KEY = "forma_reminders_v1";
const FIRED_KEY = "forma_reminders_fired";

export function loadReminders(): ReminderSettings {
  if (typeof window === "undefined") return DEFAULT_REMINDERS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_REMINDERS;
    const parsed = JSON.parse(raw) as Partial<ReminderSettings>;
    return {
      ...DEFAULT_REMINDERS,
      ...parsed,
      water: { ...DEFAULT_REMINDERS.water, ...(parsed.water ?? {}) },
      meal: { ...DEFAULT_REMINDERS.meal, ...(parsed.meal ?? {}) },
      workout: { ...DEFAULT_REMINDERS.workout, ...(parsed.workout ?? {}) },
    };
  } catch {
    return DEFAULT_REMINDERS;
  }
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

export const fmtMinutes = (min: number) =>
  `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** All reminder slots for a day, sorted by time. */
export function daySchedule(
  s: ReminderSettings,
  weekday: number,
): { kind: ReminderKind; minutes: number }[] {
  const out: { kind: ReminderKind; minutes: number }[] = [];
  if (s.water.on) {
    const from = toMinutes(s.water.from);
    const to = toMinutes(s.water.to);
    const step = Math.max(30, s.water.everyMin);
    for (let m = from; m <= to; m += step) out.push({ kind: "water", minutes: m });
  }
  if (s.meal.on)
    for (const time of s.meal.times) out.push({ kind: "meal", minutes: toMinutes(time) });
  if (s.workout.on && s.workout.days.includes(weekday))
    out.push({ kind: "workout", minutes: toMinutes(s.workout.time) });
  return out.sort((a, b) => a.minutes - b.minutes);
}

export function nextReminder(s: ReminderSettings, now = new Date()) {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  for (let offset = 0; offset < 8; offset++) {
    const day = new Date(now);
    day.setDate(now.getDate() + offset);
    const slots = daySchedule(s, day.getDay());
    const hit = slots.find((slot) => offset > 0 || slot.minutes > nowMin);
    if (hit) return { ...hit, inDays: offset };
  }
  return null;
}

type Ctx = {
  settings: ReminderSettings;
  save: (next: ReminderSettings) => void;
  waterMl: number;
  addWater: (ml: number) => void;
  resetWater: () => void;
  requestPush: () => Promise<boolean>;
  fire: (kind: ReminderKind) => void;
};

const ReminderContext = createContext<Ctx | null>(null);

const beep = () => {
  try {
    const AC = window.AudioContext ?? window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.55);
    setTimeout(() => void ctx.close(), 900);
  } catch {
    /* audio not available */
  }
};

export function ReminderProvider({ children }: { children: ReactNode }) {
  const { lang } = useI18n();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const timeZone = browserTimeZone();
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_REMINDERS);

  // Water drunk from a reminder is the same fact as water logged in the
  // hydration widget, so it is the same rows. Keeping a private
  // localStorage counter here meant two totals that could never agree, and
  // neither the coach nor the widget could see what was drunk from a
  // reminder.
  const intakeKey = ["hydration-intake", user?.id, dayInTimeZone(new Date(), timeZone)];
  const { data: intake } = useQuery({
    queryKey: intakeKey,
    queryFn: () => getHydrationIntake({ data: timeZone }),
    enabled: !!user,
  });
  const waterMl = intake?.totalMl ?? 0;

  const logWater = useMutation({
    mutationFn: (amountMl: number) => logHydration({ data: { amountMl, timeZone } }),
    onSuccess: (result) => queryClient.setQueryData(intakeKey, result),
  });
  const clearWater = useMutation({
    mutationFn: () => clearHydrationToday({ data: timeZone }),
    onSuccess: (result) => queryClient.setQueryData(intakeKey, result),
  });
  // The scheduler compares against local wall-clock hours, so its "already
  // fired today" stamp has to be the local day too. A UTC stamp kept
  // yesterday's marks alive until 03:00 in Vilnius, silently suppressing
  // the morning reminders.
  const today = useCallback(() => dayInTimeZone(new Date(), timeZone), [timeZone]);

  const langRef = useRef<Lang>(lang);
  langRef.current = lang;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    setSettings(loadReminders());
    // Legacy per-device keys, cleared rather than read. Each was a second
    // copy of a fact the server already owns: the water counter's rows now
    // live in the database, and the readiness modifier is on the check-in
    // that produced it. Leaving them would keep totals that silently diverge.
    window.localStorage.removeItem("forma_water");
    purgeLegacyAdaptationKeys();
  }, []);

  const save = useCallback((next: ReminderSettings) => {
    setSettings(next);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  }, []);

  const addWater = useCallback(
    (ml: number) => {
      if (ml > 0) logWater.mutate(ml);
    },
    [logWater],
  );
  const resetWater = useCallback(() => clearWater.mutate(), [clearWater]);

  const fire = useCallback((kind: ReminderKind) => {
    const l = langRef.current;
    const copy =
      kind === "water"
        ? { title: tr(l, "rm.water.title"), body: tr(l, "rm.water.body") }
        : kind === "meal"
          ? { title: tr(l, "rm.meal.copyTitle"), body: tr(l, "rm.meal.body") }
          : { title: tr(l, "rm.workout.copyTitle"), body: tr(l, "rm.workout.body") };
    toast(copy.title, { description: copy.body, duration: 12000 });
    const s = settingsRef.current;
    if (s.sound) beep();
    if (s.push && typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification(`GYMS.LIFE · ${copy.title}`, { body: copy.body, tag: `forma-${kind}` });
      } catch {
        /* notifications blocked */
      }
    }
  }, []);

  const requestPush = useCallback(async () => {
    if (typeof Notification === "undefined") return false;
    const res = await Notification.requestPermission();
    return res === "granted";
  }, []);

  // scheduler: checks every 30 s, fires slots whose time has passed (once per slot per day)
  useEffect(() => {
    const tick = () => {
      const s = settingsRef.current;
      if (!s.enabled) return;
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const stamp = today();
      let fired: Record<string, true> = {};
      try {
        const raw = JSON.parse(window.localStorage.getItem(FIRED_KEY) ?? "{}") as {
          date?: string;
          keys?: Record<string, true>;
        };
        if (raw.date === stamp) fired = raw.keys ?? {};
      } catch {
        /* ignore */
      }
      let changed = false;
      for (const slot of daySchedule(s, now.getDay())) {
        const key = `${slot.kind}-${slot.minutes}`;
        // fire within a 20-minute window so a slot missed while the tab was closed still shows
        if (fired[key] || slot.minutes > nowMin || nowMin - slot.minutes > 20) continue;
        fired[key] = true;
        changed = true;
        fire(slot.kind);
      }
      if (changed)
        window.localStorage.setItem(FIRED_KEY, JSON.stringify({ date: stamp, keys: fired }));
    };
    tick();
    const id = window.setInterval(tick, 30000);
    return () => window.clearInterval(id);
  }, [fire, today]);

  const value = useMemo<Ctx>(
    () => ({ settings, save, waterMl, addWater, resetWater, requestPush, fire }),
    [settings, save, waterMl, addWater, resetWater, requestPush, fire],
  );

  return <ReminderContext.Provider value={value}>{children}</ReminderContext.Provider>;
}

export function useReminders() {
  const ctx = useContext(ReminderContext);
  if (!ctx) throw new Error("useReminders must be used inside ReminderProvider");
  return ctx;
}
