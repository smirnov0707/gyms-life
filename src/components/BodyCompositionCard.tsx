import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Scale } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { browserTimeZone } from "@/lib/local-day";
import { getBodyComposition } from "@/lib/body-trend.functions";
import type { BodyCompositionReading } from "@/lib/body-trend.engine";

/**
 * What the athlete's own record says, and what follows from it arithmetically.
 *
 * Three tiers, and the card names each. Weight and body fat percentage may be
 * measured — or they may have come from the photo scan, where body fat is a
 * blend that includes a vision model's visual estimate and weight is the
 * model's own guess unless the athlete supplied one. Fat mass and lean mass
 * are neither: exact arithmetic on inexact inputs.
 *
 * This card used to say flatly that weight and body fat were measured, which
 * for a scanned reading was false — and people change their training over
 * these numbers.
 */

function Figure({
  label,
  value,
  unit,
  delta,
}: {
  label: string;
  value: number;
  unit: string;
  delta?: number;
}) {
  const { lang } = useI18n();
  const format = (input: number, signed = false) =>
    new Intl.NumberFormat(lang, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      signDisplay: signed ? "exceptZero" : "auto",
    }).format(input);

  return (
    <div className="rounded-2xl border border-border bg-surface-2 p-3">
      {/* Tighter tracking on a narrow column: "RIEBALŲ MASĖ" was breaking
          after "RIEBAL" in a third of a 320px screen. */}
      <p className="text-balance text-[10px] font-bold uppercase tracking-[0.04em] text-muted-foreground sm:tracking-[0.14em]">
        {label}
      </p>
      {/* Nowrap: at 320px the unit broke onto its own line and the column
          read "85,0 K / G". */}
      <p className="mt-1.5 whitespace-nowrap font-display text-lg leading-none tabular-nums text-foreground sm:text-xl">
        {format(value)}
        <span className="ml-1 font-sans text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {unit}
        </span>
      </p>
      {delta !== undefined ? (
        <p
          className={`mt-1 text-[11px] tabular-nums ${
            delta === 0 ? "text-muted-foreground" : "text-foreground"
          }`}
        >
          {format(delta, true)} {unit}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Where the two inputs came from, stated before the arithmetic note so the
 * reader knows what the arithmetic was performed on.
 */
function Provenance({ reading }: { reading: BodyCompositionReading }) {
  const { t } = useI18n();
  if (reading.estimated) {
    return <p className="mt-2 text-xs leading-relaxed text-accent">{t("bt.fromPhotoEstimate")}</p>;
  }
  if (reading.provenanceUnknown) {
    return (
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t("bt.sourceUnknown")}</p>
    );
  }
  return <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t("bt.fromScale")}</p>;
}

function Readings({
  latest,
  deltas,
}: {
  latest: BodyCompositionReading;
  deltas?: { weightKg: number; fatMassKg: number; leanMassKg: number };
}) {
  const { t } = useI18n();
  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      <Figure
        label={t("bt.weight")}
        value={latest.weightKg}
        unit="kg"
        {...(deltas ? { delta: deltas.weightKg } : {})}
      />
      <Figure
        label={t("bt.fat")}
        value={latest.fatMassKg}
        unit="kg"
        {...(deltas ? { delta: deltas.fatMassKg } : {})}
      />
      <Figure
        label={t("bt.lean")}
        value={latest.leanMassKg}
        unit="kg"
        {...(deltas ? { delta: deltas.leanMassKg } : {})}
      />
    </div>
  );
}

export function BodyCompositionCard() {
  const { t } = useI18n();
  const { user } = useAuth();
  const timeZone = browserTimeZone();

  const { data, isError } = useQuery({
    queryKey: ["body-composition", user?.id, timeZone],
    queryFn: () => getBodyComposition({ data: timeZone }),
    enabled: !!user,
    staleTime: 60_000,
  });

  const state = isError ? ({ status: "unreadable" } as const) : data;

  return (
    <section
      aria-label={t("bt.title")}
      className="rounded-3xl border border-border bg-surface p-4 md:p-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-foreground">
          <Scale aria-hidden="true" className="size-3.5 text-primary" />
          {t("bt.title")}
        </h2>
        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {t("bt.window")}
        </p>
      </div>

      {/* Nothing has come back yet. "No measurement yet carries both a weight
          and a body fat percentage" is a statement about the athlete's record,
          and it was being made before the record had been read — permanently
          for anyone whose session had not resolved, because the query does not
          run without a user. The card keeps its heading and says nothing. */}
      {!state ? null : state.status === "change" ? (
        <>
          <Readings
            latest={state.latest}
            deltas={{
              weightKg: state.weightKg,
              fatMassKg: state.fatMassKg,
              leanMassKg: state.leanMassKg,
            }}
          />
          <p className="mt-2 text-[11px] tabular-nums text-muted-foreground">
            {state.earliest.day} → {state.latest.day}
          </p>
          {/* A change between two readings is only as sound as the weaker of
              them: one estimated end makes the direction an estimate too. */}
          <Provenance
            reading={
              state.latest.estimated || !state.earliest.estimated ? state.latest : state.earliest
            }
          />
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("bt.derived")}</p>
        </>
      ) : state.status === "single" ? (
        <>
          <Readings latest={state.latest} />
          <p className="mt-2 text-[11px] tabular-nums text-muted-foreground">{state.latest.day}</p>
          <Provenance reading={state.latest} />
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("bt.single")}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("bt.derived")}</p>
        </>
      ) : (
        <div className="mt-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {state.status === "unreadable" ? t("bt.unreadable") : t("bt.none")}
          </p>
          {state.status === "none" ? (
            <Link
              to="/progress"
              className="mt-2 inline-flex min-h-11 items-center rounded-full border border-border px-4 text-xs font-semibold text-foreground transition-colors hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            >
              {t("bt.log")}
            </Link>
          ) : null}
        </div>
      )}
    </section>
  );
}
