import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock, Weight } from "lucide-react";
import { TwinLedgerState } from "./TwinLedgerState";
import "./TwinLedger.css";
import { WorkoutReportExporter } from "@/components/WorkoutReportExporter";
import { getWorkoutHistory } from "@/lib/workout-history.functions";
import { useAuth } from "@/lib/auth";
import { baseLang, formatLocale, useI18n } from "@/lib/i18n";

export function WorkoutHistoryPage() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const english = baseLang(lang) === "en";
  const copy = english
    ? {
        eyebrow: "Recorded training",
        title: "Workout timeline",
        description: "Your completed workouts and recorded sets.",
        loading: "Loading workout history…",
        unavailable: "Workout history could not be loaded.",
        empty: "No completed workouts yet",
        emptyHint: "Complete your first workout to see its results here.",
        unplanned: "Unplanned session",
        day: "Program day",
        sets: "completed sets · last",
        reps: "reps",
      }
    : {
        eyebrow: "Užregistruotos treniruotės",
        title: "Treniruočių istorija",
        description: "Tavo užbaigtos treniruotės ir užregistruoti setai.",
        loading: "Įkeliama treniruočių istorija…",
        unavailable: "Nepavyko įkelti treniruočių istorijos.",
        empty: "Dar nėra užbaigtų treniruočių",
        emptyHint: "Užbaik pirmą treniruotę ir jos rezultatai atsiras čia.",
        unplanned: "Neplanuota sesija",
        day: "Programos diena",
        sets: "atlikti setai · paskutinis",
        reps: "kart.",
      };
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["workout-history", user?.id],
    queryFn: () => getWorkoutHistory({ data: { limit: 20 } }),
    enabled: !!user,
    staleTime: 30_000,
  });
  return (
    <div className="fl-history-page fl-workout-ledger mx-auto max-w-[1480px] space-y-3">
      <details className="fl-secondary-details">
        <summary>
          {isError ? copy.unavailable : isLoading || !data ? copy.loading : copy.eyebrow}
        </summary>
        <section className="fl-disclosed-content fl-ledger-content">
          <header className="fl-ledger-heading">
            <p className="fl-ledger-eyebrow">{copy.eyebrow}</p>
            <h2 className="fl-ledger-title">{copy.title}</h2>
            <p className="fl-ledger-description">{copy.description}</p>
          </header>
          {isError ? (
            <TwinLedgerState
              state="error"
              title={copy.unavailable}
              onRetry={() => {
                void refetch();
              }}
              retrying={isFetching}
            />
          ) : isLoading || !data ? (
            <TwinLedgerState state="loading" title={copy.loading} />
          ) : (
            <div className="fl-workout-entries">
              {data.sessions.length > 0 ? (
                <p className="fl-ledger-note">
                  {english
                    ? "Up to 20 most recent completed sessions"
                    : "Iki 20 naujausių užbaigtų treniruočių"}
                </p>
              ) : null}
              {data.sessions.length === 0 ? (
                <TwinLedgerState state="empty" title={copy.empty} description={copy.emptyHint} />
              ) : (
                (data?.sessions ?? []).map((session) => {
                  const date = new Date(session.session.finishedAt);
                  const exercises = Array.from(
                    new Map(
                      session.sets.filter((set) => set.done).map((set) => [set.exerciseSlug, set]),
                    ).values(),
                  );
                  return (
                    <article key={session.session.id} className="fl-workout-entry">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                            <CalendarDays className="size-3.5" />
                            {date.toLocaleDateString(formatLocale(lang))}
                          </p>
                          <h3 className="mt-2 text-xl">
                            {session.session.title ?? copy.unplanned}
                          </h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {session.session.dayIndex === null
                              ? copy.unplanned
                              : `${copy.day} ${session.session.dayIndex + 1}`}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="size-4" />
                            {session.session.durationSeconds === null
                              ? "—"
                              : Math.round(session.session.durationSeconds / 60)}{" "}
                            min
                          </span>
                          <span className="flex items-center gap-1">
                            <Weight className="size-4" />
                            {session.session.totalVolume.toLocaleString(formatLocale(lang))} kg
                          </span>
                        </div>
                      </div>
                      <div className="fl-workout-sets">
                        {exercises.map((set) => (
                          <div key={set.exerciseSlug} className="fl-workout-exercise">
                            <div className="font-medium">{set.exerciseName}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {
                                session.sets.filter(
                                  (item) => item.exerciseSlug === set.exerciseSlug && item.done,
                                ).length
                              }{" "}
                              {copy.sets}: {set.reps ?? "—"} {copy.reps} × {set.weightKg ?? "—"} kg
                              {set.rpe != null ? ` · RPE ${set.rpe}` : ""}
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          )}
        </section>
      </details>
      <details className="fl-secondary-details">
        <summary>{english ? "Export & records" : "Eksportas ir įrašai"}</summary>
        <div className="fl-disclosed-content">
          <WorkoutReportExporter />
        </div>
      </details>
    </div>
  );
}
