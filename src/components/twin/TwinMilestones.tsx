import { useQuery } from "@tanstack/react-query";
import { Award, Flame, Lock, Trophy, Zap, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { baseLang, formatLocale, useI18n, type TKey } from "@/lib/i18n";
import {
  browserTimeZone,
  calculateConsecutiveCalendarDayStreak,
  dayInTimeZone,
  dayOffset,
} from "@/lib/local-day";
import { TwinLedgerState } from "./TwinLedgerState";
import "./TwinLedger.css";

export function TwinMilestones() {
  const { lang, t } = useI18n();
  const { user } = useAuth();

  const { data, isError, isFetching, refetch } = useQuery({
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
      // Carried over from the server function this screen replaced, which
      // checked its reads and this one did not: a failure arrived as an empty
      // array, so every badge locked and the streak reset to zero for someone
      // who had earned them.
      const failure = sessions.error ?? forms.error ?? checkins.error;
      if (failure) throw new Error(failure.message);
      return {
        sessions: sessions.data ?? [],
        forms: forms.data ?? [],
        checkins: checkins.data ?? [],
      };
    },
    enabled: !!user,
  });

  const lt = baseLang(lang) === "lt";
  const heading = (
    <header className="fl-ledger-heading">
      <span className="fl-ledger-eyebrow">
        <Award aria-hidden="true" />
        {lt ? "TAVO UŽREGISTRUOTAS PROGRESAS" : "YOUR RECORDED PROGRESS"}
      </span>
      <h2>{t("ach.title")}</h2>
      <p>{t("ach.sub")}</p>
    </header>
  );
  if (isError || !data)
    return (
      <section className="fl-milestones">
        {heading}
        <TwinLedgerState
          state={isError ? "error" : "loading"}
          title={
            isError ? t("ach.readFailed") : lt ? "Įkeliami pasiekimai…" : "Loading achievements…"
          }
          description={
            isError
              ? lt
                ? "Lygis, ženkleliai ir aktyvumas bus rodomi, kai istorija vėl bus pasiekiama."
                : "Your level, badges and activity will appear when your history is available again."
              : undefined
          }
          onRetry={
            isError
              ? () => {
                  void refetch();
                }
              : undefined
          }
          retrying={isFetching}
        />
      </section>
    );

  const sessions = data?.sessions ?? [];
  const volume = sessions.reduce((s, x) => s + Number(x.total_volume ?? 0), 0);
  const bestForm = Math.max(0, ...(data?.forms ?? []).map((f) => Number(f.score ?? 0)));
  const checkins = data?.checkins.length ?? 0;

  // The shared streak rule, in the athlete's timezone. This screen used to
  // walk days with `toDateString()`, which is the browser's local date: a
  // session logged late in the evening could fall on the wrong day and break
  // a streak that was never broken.
  const streak = calculateConsecutiveCalendarDayStreak(
    sessions.map((s) => s.started_at),
    browserTimeZone(),
  );

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

  // The same day key on both sides of the comparison, resolved in the
  // athlete's timezone: the heatmap used an ISO (UTC) key for the cell and a
  // browser-local key for the lookup, so cells could light up a day off.
  const timeZone = browserTimeZone();
  const trainedDays = new Set(sessions.map((s) => dayInTimeZone(new Date(s.started_at), timeZone)));
  const todayDay = dayInTimeZone(new Date(), timeZone);
  const grid = Array.from({ length: 182 }, (_, i) => {
    const key = dayOffset(todayDay, -(181 - i));
    return { key, active: trainedDays.has(key) };
  });

  const earned = badges.filter((badge) => badge.unlocked).length;
  const recorded = sessions.length > 0 || data.forms.length > 0 || checkins > 0;
  const pointsNote = lt
    ? "XP ir lygiai apibendrina aktyvumą programoje, o ne fizinį pajėgumą ar sveikatą."
    : "XP and levels summarise activity in the app, not physical ability or health.";
  return (
    <section className="fl-milestones">
      {heading}
      {!recorded ? (
        <TwinLedgerState
          state="empty"
          title={lt ? "Tavo istorija dar prasidės" : "Your story starts here"}
          description={
            lt
              ? "Užregistruok treniruotę ar dienos savijautą. Čia matysi savo sukauptą progresą."
              : "Record a workout or daily check-in. Your collected progress will appear here."
          }
        />
      ) : null}
      <div className="fl-milestone-overview">
        <div className="fl-milestone-level">
          <span className="fl-ledger-icon">
            <Trophy aria-hidden="true" />
          </span>
          <div>
            <span>{t("ach.level")}</span>
            <strong data-milestone-level>{level}</strong>
          </div>
        </div>
        <dl className="fl-ledger-metrics">
          <div>
            <dt>{t("ach.xp")}</dt>
            <dd data-milestone-xp>{xp.toLocaleString(formatLocale(lang))}</dd>
          </div>
          <div>
            <dt>
              <Flame aria-hidden="true" />
              {t("dash.streak")}
            </dt>
            <dd data-milestone-streak>{streak}</dd>
          </div>
          <div>
            <dt>{t("ach.badges")}</dt>
            <dd>
              {earned}
              <small> / {badges.length}</small>
            </dd>
          </div>
        </dl>
        <div className="fl-milestone-progress">
          <div
            role="progressbar"
            aria-label={lt ? "Progresas iki kito lygio" : "Progress to next level"}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <span style={{ width: `${pct}%` }} />
          </div>
          <p>
            {levelCeil - xp} {t("ach.xp")} {t("ach.next")}
          </p>
        </div>
        <p className="fl-ledger-note">{pointsNote}</p>
      </div>
      <section aria-labelledby="milestone-badges-title">
        <div className="fl-ledger-section-title">
          <h3 id="milestone-badges-title">{t("ach.badges")}</h3>
          <span>
            {earned} / {badges.length}
          </span>
        </div>
        <ul className="fl-milestone-badges">
          {badges.map((badge) => (
            <li key={badge.key} data-unlocked={badge.unlocked}>
              <span className="fl-ledger-icon">
                {badge.unlocked ? <Zap aria-hidden="true" /> : <Lock aria-hidden="true" />}
              </span>
              <div>
                <span className="fl-milestone-badge-status">
                  {badge.unlocked ? (lt ? "Pasiekta" : "Earned") : t("ach.locked")}
                </span>
                <h4>{t(badge.key)}</h4>
                <p>{t(badge.desc)}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="fl-milestone-activity" aria-labelledby="milestone-activity-title">
        <div className="fl-ledger-section-title">
          <h3 id="milestone-activity-title">
            <CalendarDays aria-hidden="true" />
            {t("ach.heat")}
          </h3>
          <span>{lt ? "Paskutinės 182 dienos" : "Last 182 days"}</span>
        </div>
        <div
          className="fl-milestone-calendar"
          role="region"
          aria-label={lt ? "Slenkamas treniruočių kalendorius" : "Scrollable training calendar"}
          tabIndex={0}
        >
          <div
            role="img"
            aria-label={
              lt
                ? `${grid.filter((d) => d.active).length} treniruočių dienų per paskutines 182 dienas`
                : `${grid.filter((d) => d.active).length} training days in the last 182 days`
            }
          >
            {grid.map((d) => (
              <span key={d.key} title={d.key} data-active={d.active} />
            ))}
          </div>
        </div>
        <div className="fl-milestone-calendar-legend">
          <span>
            <i aria-hidden="true" />
            {lt ? "Treniruotė neužregistruota" : "No workout recorded"}
          </span>
          <span>
            <i aria-hidden="true" data-active />
            {lt ? "Užregistruota treniruotė" : "Recorded workout"}
          </span>
        </div>
        <p className="fl-ledger-note">
          {grid[0]?.key} — {todayDay}
        </p>
      </section>
    </section>
  );
}
