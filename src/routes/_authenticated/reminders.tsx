import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bell, BellRing, Droplets, Dumbbell, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  daySchedule,
  fmtMinutes,
  nextReminder,
  useReminders,
  type ReminderKind,
  type ReminderSettings,
} from "@/lib/reminders";

export const Route = createFileRoute("/_authenticated/reminders")({
  head: () => ({
    meta: [
      { title: "Priminimai — GYMS.LIFE" },
      {
        name: "description",
        content:
          "Gėrimo, mitybos ir treniruotės priminimai pasirinktu laiku tiesiai GYMS.LIFE programoje.",
      },
      { property: "og:title", content: "Priminimai — GYMS.LIFE" },
      {
        property: "og:description",
        content: "Vandens, valgymų ir treniruotės priminimai su pasirenkamu laiku ir garsu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RemindersPage,
});

const KIND_META: Record<ReminderKind, { icon: typeof Droplets; color: string }> = {
  water: { icon: Droplets, color: "var(--primary)" },
  meal: { icon: UtensilsCrossed, color: "var(--accent)" },
  workout: { icon: Dumbbell, color: "var(--primary)" },
};

function Toggle({
  on,
  onChange,
  label,
  hint,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between gap-4 rounded-xl bg-surface-2 px-4 py-3 text-left"
    >
      <span>
        <span className="text-sm font-semibold">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      <span
        className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
        style={{ background: on ? "var(--primary)" : "var(--border)" }}
      >
        <span
          className="absolute top-0.5 size-5 rounded-full bg-background transition-all"
          style={{ left: on ? "1.5rem" : "0.125rem" }}
        />
      </span>
    </button>
  );
}

function RemindersPage() {
  const { t } = useI18n();
  const { settings, save, waterMl, addWater, resetWater, requestPush, fire } = useReminders();
  const [now] = useState(() => new Date());

  const patch = (next: Partial<ReminderSettings>) => {
    save({ ...settings, ...next });
    toast.success(t("rem.saved"));
  };

  const upcoming = useMemo(() => nextReminder(settings), [settings]);
  const today = useMemo(() => daySchedule(settings, now.getDay()), [settings, now]);
  const waterPct = Math.min(100, Math.round((waterMl / Math.max(1, settings.water.targetMl)) * 100));

  const togglePush = async (v: boolean) => {
    if (!v) return patch({ push: false });
    const ok = await requestPush();
    if (!ok) {
      toast.error(t("rem.pushDenied"));
      return;
    }
    patch({ push: true });
  };

  const setTime = (index: number, value: string) => {
    const times = [...settings.meal.times];
    times[index] = value;
    save({ ...settings, meal: { ...settings.meal, times: times.sort() } });
  };

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-primary">GYMS.LIFE HABITS</p>
        <h1 className="text-5xl">{t("rem.title")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("rem.sub")}</p>
      </div>

      <div className="panel grid gap-4 p-6 md:grid-cols-[1fr_auto] md:items-center">
        <div className="flex items-center gap-4">
          <BellRing className="size-8 text-primary" />
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {t("rem.next")}
            </p>
            <p className="text-display text-3xl text-primary">
              {upcoming
                ? `${fmtMinutes(upcoming.minutes)} · ${t(
                    upcoming.kind === "water"
                      ? "rem.water"
                      : upcoming.kind === "meal"
                        ? "rem.meal"
                        : "rem.workout",
                  )}`
                : t("rem.none")}
            </p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 md:w-[420px]">
          <Toggle
            on={settings.enabled}
            onChange={(v) => patch({ enabled: v })}
            label={t("rem.enable")}
          />
          <Toggle on={settings.sound} onChange={(v) => patch({ sound: v })} label={t("rem.sound")} />
          <div className="sm:col-span-2">
            <Toggle
              on={settings.push}
              onChange={togglePush}
              label={t("rem.push")}
              hint={t("rem.pushHint")}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* WATER */}
        <div className="panel grid content-start gap-3 p-6">
          <h2 className="flex items-center gap-2 text-2xl">
            <Droplets className="size-5 text-primary" /> {t("rem.water")}
          </h2>
          <Toggle
            on={settings.water.on}
            onChange={(v) => patch({ water: { ...settings.water, on: v } })}
            label={settings.water.on ? "ON" : "OFF"}
          />
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["rem.from", "from", "time"],
                ["rem.to", "to", "time"],
                ["rem.every", "everyMin", "number"],
                ["rem.target", "targetMl", "number"],
              ] as const
            ).map(([key, field, type]) => (
              <label key={field} className="grid gap-1.5 text-sm">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {t(key)}
                </span>
                <input
                  type={type}
                  value={settings.water[field] as string | number}
                  onChange={(e) =>
                    save({
                      ...settings,
                      water: {
                        ...settings.water,
                        [field]: type === "number" ? Number(e.target.value) : e.target.value,
                      },
                    })
                  }
                  className="h-10 rounded-lg border border-border bg-surface-2 px-3"
                />
              </label>
            ))}
          </div>
          <div className="rounded-xl bg-surface-2 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                {t("rem.todayWater")}
              </span>
              <span className="text-display text-2xl text-primary">
                {waterMl} / {settings.water.targetMl} ml
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-[var(--primary)] transition-all"
                style={{ width: `${waterPct}%` }}
              />
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                className="flex-1 font-bold"
                onClick={() => addWater(settings.water.ml)}
              >
                <Plus className="mr-1 size-4" /> {t("rem.addWater")} {settings.water.ml} ml
              </Button>
              <Button size="sm" variant="outline" onClick={resetWater}>
                {t("rem.resetWater")}
              </Button>
            </div>
          </div>
        </div>

        {/* MEALS */}
        <div className="panel grid content-start gap-3 p-6">
          <h2 className="flex items-center gap-2 text-2xl">
            <UtensilsCrossed className="size-5 text-accent" /> {t("rem.meal")}
          </h2>
          <Toggle
            on={settings.meal.on}
            onChange={(v) => patch({ meal: { ...settings.meal, on: v } })}
            label={settings.meal.on ? "ON" : "OFF"}
          />
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {t("rem.times")}
          </p>
          <div className="grid gap-2">
            {settings.meal.times.map((time, i) => (
              <div key={`${time}-${i}`} className="flex items-center gap-2">
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(i, e.target.value)}
                  className="h-10 flex-1 rounded-lg border border-border bg-surface-2 px-3 text-sm"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    save({
                      ...settings,
                      meal: {
                        ...settings.meal,
                        times: settings.meal.times.filter((_, idx) => idx !== i),
                      },
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              save({
                ...settings,
                meal: { ...settings.meal, times: [...settings.meal.times, "15:00"].sort() },
              })
            }
          >
            <Plus className="mr-1 size-4" /> {t("rem.addTime")}
          </Button>
        </div>

        {/* WORKOUT */}
        <div className="panel grid content-start gap-3 p-6">
          <h2 className="flex items-center gap-2 text-2xl">
            <Dumbbell className="size-5 text-primary" /> {t("rem.workout")}
          </h2>
          <Toggle
            on={settings.workout.on}
            onChange={(v) => patch({ workout: { ...settings.workout, on: v } })}
            label={settings.workout.on ? "ON" : "OFF"}
          />
          <label className="grid gap-1.5 text-sm">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              {t("rem.time")}
            </span>
            <input
              type="time"
              value={settings.workout.time}
              onChange={(e) =>
                save({ ...settings, workout: { ...settings.workout, time: e.target.value } })
              }
              className="h-10 rounded-lg border border-border bg-surface-2 px-3"
            />
          </label>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            {t("rem.days")}
          </span>
          <div className="flex flex-wrap gap-2">
            {(
              [
                t("rm.day.sun"),
                t("rm.day.mon"),
                t("rm.day.tue"),
                t("rm.day.wed"),
                t("rm.day.thu"),
                t("rm.day.fri"),
                t("rm.day.sat"),
              ] as const
            ).map((label, index) => {
              const active = settings.workout.days.includes(index);
              return (
                <button
                  key={index}
                  onClick={() =>
                    save({
                      ...settings,
                      workout: {
                        ...settings.workout,
                        days: active
                          ? settings.workout.days.filter((d) => d !== index)
                          : [...settings.workout.days, index].sort(),
                      },
                    })
                  }
                  className={`size-10 rounded-full text-sm font-bold transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-2 text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="panel grid gap-5 p-6">
        <div className="grid gap-3">
          <h2 className="flex items-center gap-2 text-2xl">
            <Bell className="size-5 text-primary" /> {t("rem.schedule")}
          </h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {(["water", "meal", "workout"] as ReminderKind[]).map((kind) => {
              const Icon = KIND_META[kind].icon;
              return (
                <Button
                  key={kind}
                  size="sm"
                  variant="outline"
                  className="justify-start gap-2 whitespace-normal text-left"
                  onClick={() => fire(kind)}
                >
                  <Icon className="size-4 shrink-0" style={{ color: KIND_META[kind].color }} />
                  {t("rem.preview")}:{" "}
                  {t(kind === "water" ? "rem.water" : kind === "meal" ? "rem.meal" : "rem.workout")}
                </Button>
              );
            })}
          </div>
        </div>
        {!today.length ? (
          <p className="text-sm text-muted-foreground">{t("rem.none")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {today.map((slot, i) => {
              const Icon = KIND_META[slot.kind].icon;
              const past = slot.minutes < now.getHours() * 60 + now.getMinutes();
              return (
                <div
                  key={`${slot.kind}-${slot.minutes}-${i}`}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
                    past ? "bg-surface-2 text-muted-foreground" : "bg-surface-2"
                  }`}
                  style={{ boxShadow: past ? undefined : `inset 0 0 0 1px ${KIND_META[slot.kind].color}` }}
                >
                  <Icon className="size-4 shrink-0" style={{ color: KIND_META[slot.kind].color }} />
                  <span className="text-display text-base">{fmtMinutes(slot.minutes)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
