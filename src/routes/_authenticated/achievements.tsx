import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Award, Flame, Lock, Trophy, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n, type TKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/achievements")({
  head: () => ({
    meta: [
      { title: "Pasiekimai ir XP — GYMS.LIFE" },
      {
        name: "description",
        content:
          "Rink XP už kiekvieną treniruotę, kelk lygį, atrakink ženkliukus ir stebėk metų aktyvumo žemėlapį.",
      },
      { property: "og:title", content: "Pasiekimai ir XP — GYMS.LIFE" },
      { property: "og:description", content: "Lygiai, ženkliukai ir aktyvumo žemėlapis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AchievementsPage,
});

function AchievementsPage() {
  const { t } = useI18n();
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["achievements", user?.id],
    queryFn: async () => {
      const [sessions, forms, checkins] = await Promise.all([
        supabase
          .from("workout_sessions")
          .select("started_at, total_volume")
          .eq("user_id", user!.id)
          .not("finished_at", "is", null),
        supabase.from("form_analyses").select("score").eq("user_id", user!.id),
        supabase.from("daily_checkins").select("checkin_on").eq("user_id", user!.id),
      ]);
      return {
        sessions: sessions.data ?? [],
        forms: forms.data ?? [],
        checkins: checkins.data ?? [],
      };
    },
    enabled: !!user,
  });

  const sessions = data?.sessions ?? [];
  const volume = sessions.reduce((s, x) => s + Number(x.total_volume ?? 0), 0);
  const bestForm = Math.max(0, ...(data?.forms ?? []).map((f) => Number(f.score ?? 0)));
  const checkins = data?.checkins.length ?? 0;

  const days = new Set(sessions.map((s) => new Date(s.started_at).toDateString()));
  let streak = 0;
  {
    const cursor = new Date();
    for (let i = 0; i < 400; i++) {
      if (days.has(cursor.toDateString())) streak++;
      else if (i > 0) break;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  const xp = Math.round(sessions.length * 120 + volume / 100 + bestForm * 2 + checkins * 30);
  const level = Math.max(1, Math.floor(Math.sqrt(xp / 250)) + 1);
  const levelFloor = Math.pow(level - 1, 2) * 250;
  const levelCeil = Math.pow(level, 2) * 250;
  const pct = Math.min(100, Math.round(((xp - levelFloor) / (levelCeil - levelFloor)) * 100));

  const badges: { key: TKey; desc: TKey; unlocked: boolean }[] = [
    { key: "ach.b1", desc: "ach.b1d", unlocked: sessions.length >= 1 },
    { key: "ach.b2", desc: "ach.b2d", unlocked: sessions.length >= 10 },
    { key: "ach.b3", desc: "ach.b3d", unlocked: sessions.length >= 50 },
    { key: "ach.b4", desc: "ach.b4d", unlocked: volume >= 50000 },
    { key: "ach.b5", desc: "ach.b6", unlocked: streak >= 7 },
    { key: "ach.b7", desc: "ach.b7d", unlocked: bestForm >= 90 },
    { key: "ach.b8", desc: "ach.b8d", unlocked: checkins >= 7 },
  ];

  const grid = Array.from({ length: 182 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (181 - i));
    return { key: d.toISOString().slice(0, 10), active: days.has(d.toDateString()) };
  });

  return (
    <div className="grid gap-8">
      <header>
        <p className="text-xs uppercase tracking-widest text-primary">GYMS.LIFE · XP</p>
        <h1 className="mt-1 text-5xl">{t("ach.title")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("ach.sub")}</p>
      </header>

      <div className="panel relative overflow-hidden p-6 md:p-8">
        <div className="grain-hero pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="flex items-center gap-5">
            <span className="grid size-16 place-items-center rounded-2xl bg-primary text-primary-foreground glow-ring">
              <Trophy className="size-7" />
            </span>
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                {t("ach.level")}
              </div>
              <div className="text-display text-6xl leading-none">{level}</div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <div className="text-display text-4xl leading-none text-primary">
                {xp.toLocaleString("lt-LT")}
              </div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                {t("ach.xp")}
              </div>
            </div>
            <div>
              <div className="text-display flex items-center gap-1 text-4xl leading-none text-accent">
                <Flame className="size-6" />
                {streak}
              </div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                {t("dash.streak")}
              </div>
            </div>
          </div>
        </div>
        <div className="relative mt-6">
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {levelCeil - xp} {t("ach.xp")} {t("ach.next")}
          </p>
        </div>
      </div>

      <section>
        <h2 className="flex items-center gap-2 text-3xl">
          <Award className="size-5 text-primary" /> {t("ach.badges")}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {badges.map((b) => (
            <div
              key={b.key}
              className={cn(
                "panel flex items-start gap-4 p-5 transition-all",
                b.unlocked ? "border-primary/40 glow-ring" : "opacity-60",
              )}
            >
              <span
                className={cn(
                  "grid size-11 shrink-0 place-items-center rounded-xl",
                  b.unlocked ? "bg-primary/15 text-primary" : "bg-surface-2 text-muted-foreground",
                )}
              >
                {b.unlocked ? <Zap className="size-5" /> : <Lock className="size-4" />}
              </span>
              <div>
                <div className="text-lg font-semibold leading-tight">{t(b.key)}</div>
                <p className="text-xs text-muted-foreground">
                  {b.unlocked ? t(b.desc) : `${t("ach.locked")} · ${t(b.desc)}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-3xl">{t("ach.heat")}</h2>
        <div className="panel mt-4 overflow-x-auto p-5">
          <div className="grid grid-flow-col grid-rows-7 gap-1">
            {grid.map((d) => (
              <span
                key={d.key}
                title={d.key}
                className={cn("size-3 rounded-[3px]", d.active ? "bg-primary" : "bg-surface-2")}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
