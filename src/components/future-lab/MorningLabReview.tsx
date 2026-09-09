import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { baseLang, formatLocale, useI18n } from "@/lib/i18n";
import { getMorningNightReview } from "@/lib/night-lab.functions";
import { NightReviewReadSchema } from "@/lib/night-review.schema";
import { dayInTimeZone } from "@/lib/local-day";
/** A read of confirmed work, not an AI-generated claim that work happened. */
export function MorningLabReview({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth(),
    { lang, t } = useI18n(),
    lt = baseLang(lang) === "lt";
  const query = useQuery({
    queryKey: ["night-review", user?.id],
    enabled: !!user,
    retry: false,
    staleTime: 60_000,
    queryFn: async () => {
      if (!user) throw new Error("Authentication required");
      return NightReviewReadSchema.parse(
        await getMorningNightReview({ data: { ownerId: user.id } }),
      );
    },
  });
  if (!user) return null;
  const data = query.isError ? { state: "unavailable" as const } : query.data;
  const title = lt ? "Ryto patikros įrašas" : "Morning review receipt";
  if (!data)
    return (
      <section aria-label={title} className="rounded-xl border border-border bg-surface p-3">
        <p role="status" className="text-xs text-muted-foreground">
          {lt ? "Tikrinamas išsaugotas rezultatas…" : "Checking the saved result…"}
        </p>
      </section>
    );
  if (data.state !== "ready")
    return (
      <section
        aria-label={title}
        className="rounded-xl border border-border bg-surface p-3 text-xs"
      >
        <p role={data.state === "unavailable" ? "alert" : "status"}>
          {data.state === "unavailable"
            ? lt
              ? "Patikros įrašo nepavyko perskaityti. Tai nereiškia, kad analizė nevyko."
              : "The review record is unavailable. This does not mean no work happened."
            : lt
              ? "Patvirtintos nakties patikros dar nėra. Suplanuotas paleidimas nėra atliktos analizės įrodymas."
              : "No confirmed overnight review yet. A scheduled run is not proof of completed analysis."}
        </p>
      </section>
    );
  const r = data.review,
    currentDay = dayInTimeZone(new Date(), r.timeZone),
    fresh = r.reviewOn === currentDay;
  const status =
    r.status === "completed"
      ? lt
        ? "Patikra patvirtinta"
        : "Review confirmed"
      : r.status === "partial"
        ? lt
          ? "Patikra dalinė"
          : "Partial review"
        : lt
          ? "Patikra sustabdyta"
          : "Review blocked";
  return (
    <section
      aria-label={title}
      data-review-status={r.status}
      className="space-y-2 rounded-xl border border-border bg-surface p-3 text-foreground"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs">{status}</span>
      </header>
      <p className="text-xs text-muted-foreground">
        {fresh
          ? lt
            ? "Šios vietinės dienos įrašas"
            : "This local day's record"
          : lt
            ? "Ankstesnės dienos įrašas"
            : "Earlier day's record"}{" "}
        · {r.reviewOn} ·{" "}
        {new Date(r.reviewedAt).toLocaleTimeString(formatLocale(lang), {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: r.timeZone,
        })}
      </p>
      {r.snapshot.status !== "confirmed" ? (
        <p className="text-xs">
          {lt
            ? "Nepatvirtinta žmogaus būsena nenaudota prognozėms ar hipotezėms atnaujinti."
            : "An unconfirmed athlete state was not used to update predictions or hypotheses."}
        </p>
      ) : (
        <p className="text-xs">
          {lt
            ? "Žmogaus būsenos istorijos taškas patvirtintas."
            : "The athlete-state history point is confirmed."}
        </p>
      )}
      {r.predictions.status === "completed" ? (
        <p className="text-xs">
          {lt ? "Prognozių įrašų įvertinta" : "Prediction records evaluated"}:{" "}
          <strong>{r.predictions.result.evaluated}</strong> ·{" "}
          {lt ? "atskirų dienų" : "distinct days"}:{" "}
          <strong>{r.predictions.result.independentDays}</strong>.{" "}
          {r.predictions.result.pending > 0
            ? lt
              ? `Rezultato dar laukiama: ${r.predictions.result.pending}.`
              : `Still awaiting an outcome: ${r.predictions.result.pending}.`
            : null}
          {r.predictions.result.limited ? (
            <span>
              {" "}
              {lt
                ? "Pasiekta patikros riba; tai ne visa istorija."
                : "Review limit reached; this is not the full history."}
            </span>
          ) : null}
        </p>
      ) : r.predictions.status === "unavailable" ? (
        <p role="alert" className="text-xs">
          {lt
            ? "Prognozių patikra nepatvirtinta; nulis rezultatų nerodomas."
            : "Prediction review is unconfirmed; it is not shown as zero outcomes."}
        </p>
      ) : null}
      {r.hypotheses.status === "completed" ? (
        <p className="text-xs">
          {lt ? "Hipotezių patikrinta" : "Hypotheses reviewed"}:{" "}
          <strong>{r.hypotheses.result.current.length}</strong> ·{" "}
          {lt ? "užregistruotų būsenos pokyčių" : "recorded status transitions"}:{" "}
          <strong>{r.hypotheses.result.transitions.length}</strong>.
        </p>
      ) : r.hypotheses.status === "unavailable" ? (
        <p role="alert" className="text-xs">
          {lt
            ? "Hipotezių istorijos atnaujinimas nepatvirtintas."
            : "The hypothesis-history update is not confirmed."}
        </p>
      ) : null}
      <details className="text-xs" open={compact ? undefined : true}>
        <summary className="min-h-11 cursor-pointer py-3">
          {lt ? "Įrodymai ir ribos" : "Evidence and limits"}
        </summary>
        <p>
          {lt
            ? "Modelio svoriai ir treniruočių planas šia patikra nekeisti. Tai įrodymų patikra, ne išmokto priežastinio ryšio garantija."
            : "Model weights and the training plan were not changed by this review. This is an evidence review, not proof of a learned causal relationship."}
        </p>
        {r.hypotheses.status === "completed" &&
          r.hypotheses.result.current.map((h) => (
            <p key={h.id} className="mt-2">
              {h.id === "training-response-repeated-low-feeling"
                ? lt
                  ? "Pasikartojanti prasta savijauta po treniruotės"
                  : "Repeated low post-workout feeling"
                : h.id === "training-behavior-usual-day-fit"
                  ? lt
                    ? "Įprastų treniruočių dienų tinkamumas"
                    : "Usual training-day fit"
                  : lt
                    ? "Stebima hipotezė"
                    : "Tracked hypothesis"}{" "}
              · {h.evidenceCount}/{h.minimumEvidenceCount} ·{" "}
              {h.status === "supported"
                ? lt
                  ? "palaiko turimi duomenys"
                  : "supported by available evidence"
                : h.status === "insufficient_evidence"
                  ? lt
                    ? "nepakanka įrodymų"
                    : "insufficient evidence"
                  : lt
                    ? "stebima"
                    : "monitoring"}
            </p>
          ))}
        <p className="mt-2 break-all text-muted-foreground">
          {lt ? "Paleidimas" : "Run"}: {r.runKey} · {lt ? "Įrašas" : "Receipt"}: {data.reviewId}
        </p>
        <Link to="/lab" className="mt-2 inline-flex min-h-11 items-center underline">
          {lt ? "Peržiūrėti laboratorijoje" : "Review in the Lab"}
        </Link>
      </details>
    </section>
  );
}
