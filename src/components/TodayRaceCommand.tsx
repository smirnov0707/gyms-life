import { Activity, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getActiveRacePrep } from "@/lib/endurance-race-prep.functions";
import { browserTimeZone, dayInTimeZone } from "@/lib/local-day";
import { baseLang, useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";

const km = (meters: number) => {
  const value = meters / 1000;
  return value.toFixed(meters % 1000 === 0 ? 0 : 1);
};

export function TodayRaceCommand() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const english = baseLang(lang) === "en";
  const timeZone = browserTimeZone();
  const today = dayInTimeZone(new Date(), timeZone);
  const { data } = useQuery({
    queryKey: ["active-race-prep", user?.id, today, timeZone],
    queryFn: () => getActiveRacePrep({ data: { today, timeZone } }),
    enabled: Boolean(user),
    staleTime: 30_000,
  });

  if (!data || data.status === "none") return null;

  const decision = data.intelligence;
  const distance =
    decision.nextSession.plannedDistanceMeters === null
      ? null
      : decision.nextSession.plannedDistanceMeters * decision.nextSession.volumeModifier;
  const protect = decision.action === "recover" || decision.action === "reduce";

  return (
    <div className="fl-surface flex items-start gap-3 p-4" data-race-command={decision.action}>
      {protect ? (
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
      ) : (
        <Activity className="mt-0.5 size-5 shrink-0 text-primary" />
      )}
      <div className="min-w-0">
        <p className="fl-eyebrow">{english ? "RACE PREP TODAY" : "RACE PREP ŠIANDIEN"}</p>
        <p className="mt-1 text-sm font-semibold">
          {decision.action === "recover"
            ? english
              ? "Protect recovery"
              : "Saugok atsistatymą"
            : decision.action === "reduce"
              ? english
                ? "Run lighter"
                : "Bėk lengviau"
              : decision.action === "proceed"
                ? english
                  ? "Proceed with the plan"
                  : "Tęsk pagal planą"
                : english
                  ? "Keep the next run conservative"
                  : "Kitą bėgimą laikyk konservatyvų"}
        </p>
        {decision.nextSession.intent ? (
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="capitalize">{decision.nextSession.intent}</span>
            {distance !== null ? ` · ${km(distance)} km` : ""}
            {" · "}
            {decision.confidence === "high"
              ? english
                ? "high confidence"
                : "aukštas patikimumas"
              : decision.confidence === "moderate"
                ? english
                  ? "moderate confidence"
                  : "vidutinis patikimumas"
                : english
                  ? "learning"
                  : "mokymosi režimas"}
          </p>
        ) : null}
      </div>
    </div>
  );
}
