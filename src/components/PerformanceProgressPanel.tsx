import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Dumbbell, Gauge, TrendingUp } from "lucide-react";
import {
  getPerformanceOverview,
  getStrengthTrend,
  getVolumeTrend,
} from "@/lib/performance.functions";
import { useAuth } from "@/lib/auth";
import { baseLang, formatLocale, useI18n } from "@/lib/i18n";
import { TwinLedgerState } from "@/components/twin/TwinLedgerState";
import "./PerformanceProgressPanel.css";

const COPY = {
  en: {
    eyebrow: "RECORDED PERFORMANCE",
    title: "Your training, over time",
    note: "Figures come from completed sessions and sets. Estimated 1RM is calculated from recorded load and repetitions; it is not a weight you actually lifted.",
    workouts: "Workouts",
    volume: "Total volume",
    sets: "Completed sets",
    rpe: "Average RPE",
    loading: "Loading training progress…",
    failed: "Training progress could not be loaded.",
    empty: "Your progress starts with a completed workout",
    emptyHint: "Recorded sessions and sets will appear here.",
    volumeTitle: "Training volume",
    volumeNote: "Up to 14 most recent completed sessions.",
    strengthTitle: "Estimated 1RM",
    strengthNote:
      "Up to 14 most recent estimates for the selected exercise. Compare the same exercise over time.",
    volumeLoading: "Loading training volume…",
    volumeFailed: "Training volume is temporarily unavailable.",
    volumeEmpty: "No completed sessions in this history",
    strengthLoading: "Loading strength estimates…",
    strengthFailed: "Strength estimates are temporarily unavailable.",
    strengthEmpty: "No strength estimates yet",
    strengthEmptyHint: "An estimate needs a completed set with recorded load and repetitions.",
    exercise: "Exercise",
    details: "View recorded values",
    date: "Date",
    entry: "Session / exercise",
    value: "Value",
    exercises: "Exercise records",
    bestWeight: "Best recorded load",
    sessions: "sessions",
    reps: "reps",
    noExercises: "No completed exercise sets yet",
  },
  lt: {
    eyebrow: "UŽREGISTRUOTI REZULTATAI",
    title: "Tavo treniruočių progresas",
    note: "Rodikliai apskaičiuoti iš užbaigtų treniruočių ir atliktų setų. Apytikris 1RM skaičiuojamas pagal užregistruotą svorį ir pakartojimus; tai nėra faktiškai pakeltas svoris.",
    workouts: "Treniruotės",
    volume: "Bendra apimtis",
    sets: "Atlikti setai",
    rpe: "Vidutinis RPE",
    loading: "Įkeliamas treniruočių progresas…",
    failed: "Nepavyko įkelti treniruočių progreso.",
    empty: "Progresas prasideda nuo užbaigtos treniruotės",
    emptyHint: "Čia atsiras užregistruotos treniruotės ir atlikti setai.",
    volumeTitle: "Treniruočių apimtis",
    volumeNote: "Iki 14 naujausių užbaigtų treniruočių.",
    strengthTitle: "Apytikris 1RM",
    strengthNote:
      "Iki 14 naujausių pasirinkto pratimo įverčių. Lygink to paties pratimo rezultatus laikui bėgant.",
    volumeLoading: "Įkeliama treniruočių apimtis…",
    volumeFailed: "Treniruočių apimtis laikinai nepasiekiama.",
    volumeEmpty: "Šioje istorijoje nėra užbaigtų treniruočių",
    strengthLoading: "Įkeliami jėgos įverčiai…",
    strengthFailed: "Jėgos įverčiai laikinai nepasiekiami.",
    strengthEmpty: "Jėgos įverčių dar nėra",
    strengthEmptyHint: "Įverčiui reikia atlikto seto su užregistruotu svoriu ir pakartojimais.",
    exercise: "Pratimas",
    details: "Peržiūrėti užregistruotas reikšmes",
    date: "Data",
    entry: "Treniruotė / pratimas",
    value: "Reikšmė",
    exercises: "Pratimų rezultatai",
    bestWeight: "Didžiausias užregistruotas svoris",
    sessions: "treniruočių",
    reps: "pakartojimų",
    noExercises: "Atliktų pratimų setų dar nėra",
  },
};
type Copy = typeof COPY.en;
type Point = { id: string; date: string; label: string; value: number };

function Trend({
  points,
  locale,
  copy,
  name,
}: {
  points: Point[];
  locale: string;
  copy: Copy;
  name: string;
}) {
  const visible = [...points].sort((a, b) => Date.parse(a.date) - Date.parse(b.date)).slice(-14);
  const latest = visible.at(-1);
  const maximum = Math.max(1, ...visible.map((p) => p.value));
  const date = (value: string) => new Date(value).toLocaleDateString(locale);
  return (
    <>
      <div className="fl-performance-plot" role="img" aria-label={name}>
        <div aria-hidden="true" className="fl-performance-bars">
          {visible.map((p) => (
            <div key={p.id} className="fl-performance-column">
              <div
                className="fl-performance-bar-track"
                title={`${p.label} · ${date(p.date)} · ${p.value.toLocaleString(locale)} kg`}
              >
                <span
                  data-performance-bar
                  data-value={p.value}
                  style={{ height: `${(p.value / maximum) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="fl-performance-axis" aria-hidden="true">
          <span>{visible[0] ? date(visible[0].date) : ""}</span>
          <span>{latest ? date(latest.date) : ""}</span>
        </div>
      </div>
      <details className="fl-performance-values">
        <summary>{copy.details}</summary>
        <div role="region" aria-label={name + " · " + copy.details} tabIndex={0}>
          <table>
            <caption className="sr-only">{name}</caption>
            <thead>
              <tr>
                <th scope="col">{copy.date}</th>
                <th scope="col">{copy.entry}</th>
                <th scope="col">{copy.value}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.id}>
                  <td>{date(p.date)}</td>
                  <td>{p.label}</td>
                  <td>{p.value.toLocaleString(locale)} kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

export function PerformanceProgressPanel() {
  const { lang } = useI18n();
  const { user } = useAuth();
  const copy = COPY[baseLang(lang)],
    locale = formatLocale(lang);
  const [selectedExercise, setSelectedExercise] = useState("");
  const overview = useQuery({
    queryKey: ["performance-overview", user?.id],
    queryFn: () => getPerformanceOverview(),
    enabled: !!user,
    staleTime: 60_000,
  });
  const volume = useQuery({
    queryKey: ["volume-trend", user?.id],
    queryFn: () => getVolumeTrend(),
    enabled: !!user,
    staleTime: 60_000,
  });
  const strength = useQuery({
    queryKey: ["strength-trend", user?.id],
    queryFn: () => getStrengthTrend(),
    enabled: !!user,
    staleTime: 60_000,
  });
  const exercises = Array.from(
    new Map((strength.data?.points ?? []).map((p) => [p.exerciseSlug, p.exerciseName])),
  );
  const chosen = exercises.some(([slug]) => slug === selectedExercise)
    ? selectedExercise
    : exercises[0]?.[0];
  const failed = overview.isError || (!!overview.data && overview.data.status !== "READY");
  const m = !failed ? overview.data?.metrics : undefined;
  const metrics = m
    ? [
        { label: copy.workouts, value: m.workouts, unit: "", icon: Dumbbell },
        { label: copy.volume, value: m.totalVolume, unit: "kg", icon: BarChart3 },
        { label: copy.sets, value: m.totalSets, unit: "", icon: Dumbbell },
        { label: copy.rpe, value: m.averageRpe, unit: "", icon: Gauge },
      ]
    : [];
  return (
    <section className="fl-performance">
      <header className="fl-ledger-heading">
        <span className="fl-ledger-eyebrow">
          <TrendingUp aria-hidden="true" />
          {copy.eyebrow}
        </span>
        <h2>{copy.title}</h2>
        <p>{copy.note}</p>
      </header>
      {failed || !m ? (
        <TwinLedgerState
          state={failed ? "error" : "loading"}
          title={failed ? copy.failed : copy.loading}
          onRetry={
            failed
              ? () => {
                  void overview.refetch();
                }
              : undefined
          }
          retrying={overview.isFetching}
        />
      ) : (
        <>
          {m.workouts === 0 ? (
            <TwinLedgerState state="empty" title={copy.empty} description={copy.emptyHint} />
          ) : null}
          <dl className="fl-performance-metrics">
            {metrics.map(({ label, value, unit, icon: Icon }) => (
              <div key={label}>
                <dt>
                  <Icon aria-hidden="true" />
                  {label}
                </dt>
                <dd>
                  {value === null ? "—" : value.toLocaleString(locale)}
                  {unit ? <small> {unit}</small> : null}
                </dd>
              </div>
            ))}
          </dl>
          <div className="fl-performance-trends">
            <section className="fl-performance-trend" data-trend="volume">
              <header>
                <BarChart3 aria-hidden="true" />
                <h3>{copy.volumeTitle}</h3>
              </header>
              <p>{copy.volumeNote}</p>
              {volume.isError || (!!volume.data && volume.data.status !== "READY") ? (
                <TwinLedgerState
                  state="error"
                  title={copy.volumeFailed}
                  onRetry={() => {
                    void volume.refetch();
                  }}
                  retrying={volume.isFetching}
                />
              ) : !volume.data ? (
                <TwinLedgerState state="loading" title={copy.volumeLoading} />
              ) : !volume.data.points.length ? (
                <TwinLedgerState state="empty" title={copy.volumeEmpty} />
              ) : (
                <Trend
                  name={copy.volumeTitle}
                  locale={locale}
                  copy={copy}
                  points={volume.data.points.map((p, i) => ({
                    id: `${p.date}-${i}`,
                    date: p.date,
                    label: p.workout ?? "—",
                    value: p.volume,
                  }))}
                />
              )}
            </section>
            <section className="fl-performance-trend" data-trend="strength">
              <header>
                <TrendingUp aria-hidden="true" />
                <h3>{copy.strengthTitle}</h3>
              </header>
              <p>{copy.strengthNote}</p>
              {strength.isError || (!!strength.data && strength.data.status !== "READY") ? (
                <TwinLedgerState
                  state="error"
                  title={copy.strengthFailed}
                  onRetry={() => {
                    void strength.refetch();
                  }}
                  retrying={strength.isFetching}
                />
              ) : !strength.data ? (
                <TwinLedgerState state="loading" title={copy.strengthLoading} />
              ) : !strength.data.points.length ? (
                <TwinLedgerState
                  state="empty"
                  title={copy.strengthEmpty}
                  description={copy.strengthEmptyHint}
                />
              ) : (
                <>
                  <label className="fl-performance-select">
                    {copy.exercise}
                    <select value={chosen} onChange={(e) => setSelectedExercise(e.target.value)}>
                      {exercises.map(([slug, name]) => (
                        <option key={slug} value={slug}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Trend
                    name={copy.strengthTitle}
                    locale={locale}
                    copy={copy}
                    points={strength.data.points
                      .filter((p) => p.exerciseSlug === chosen)
                      .map((p, i) => ({
                        id: `${p.date}-${i}`,
                        date: p.date,
                        label: p.exerciseName,
                        value: p.estimated1RMKg,
                      }))}
                  />
                </>
              )}
            </section>
          </div>
          <section className="fl-performance-records">
            <h3>{copy.exercises}</h3>
            {!overview.data?.exercises.length ? (
              <p className="fl-ledger-note">{copy.noExercises}</p>
            ) : (
              <ul>
                {overview.data.exercises.map((e) => (
                  <li key={e.exerciseSlug}>
                    <h4>{e.exerciseName}</h4>
                    <p>
                      {e.sessions} {copy.sessions} · {e.totalSets} {copy.sets.toLowerCase()} ·{" "}
                      {e.totalReps} {copy.reps}
                    </p>
                    <dl>
                      <div>
                        <dt>{copy.bestWeight}</dt>
                        <dd>
                          {e.bestWeightKg?.toLocaleString(locale) ?? "—"} <small>kg</small>
                        </dd>
                      </div>
                      <div>
                        <dt>{copy.strengthTitle}</dt>
                        <dd>
                          {e.bestEstimated1RMKg?.toLocaleString(locale) ?? "—"} <small>kg</small>
                        </dd>
                      </div>
                    </dl>
                    <footer>
                      <span>
                        {copy.volume}: {e.totalVolume.toLocaleString(locale)} kg
                      </span>
                      <span>RPE {e.averageRpe?.toLocaleString(locale) ?? "—"}</span>
                    </footer>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </section>
  );
}
