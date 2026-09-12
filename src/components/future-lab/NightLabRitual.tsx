import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { MoonStar } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { baseLang, formatLocale, useI18n } from "@/lib/i18n";
import { getMorningNightReview } from "@/lib/night-lab.functions";
import { NightReviewReadSchema } from "@/lib/night-review.schema";

export function NightLabRitual() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const english = baseLang(lang) === "en";
  const query = useQuery({
    queryKey: ["night-review", user?.id],
    enabled: !!user,
    retry: false,
    staleTime: 60_000,
    queryFn: async () =>
      NightReviewReadSchema.parse(await getMorningNightReview({ data: { ownerId: user!.id } })),
  });
  if (!user) return null;
  const data = query.data;
  if (query.isError || (data && data.state !== "ready")) return null;
  if (!data)
    return (
      <section className="rounded-2xl border border-border bg-surface/80 p-4">
        <p role="status" className="text-xs text-muted-foreground">
          {english ? "Night Lab receipt is being checked…" : "Tikrinamas Night Lab įrašas…"}
        </p>
      </section>
    );
  const r = data.review;
  const predictions = r.predictions.status === "completed" ? r.predictions.result.evaluated : null;
  const hypotheses =
    r.hypotheses.status === "completed" ? r.hypotheses.result.current.length : null;
  const transitions =
    r.hypotheses.status === "completed" ? r.hypotheses.result.transitions.length : null;
  return (
    <section
      className="rounded-2xl border border-violet-300/20 bg-surface/85 p-4 sm:p-5"
      aria-label="Night Lab"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[9px] font-medium uppercase tracking-[0.18em] text-violet-300">
            <MoonStar aria-hidden="true" className="size-3.5" /> NIGHT LAB ·{" "}
            {new Date(r.reviewedAt).toLocaleTimeString(formatLocale(lang), {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: r.timeZone,
            })}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">
            {english ? "What changed while you were away" : "Kas pasikeitė, kol tavęs nebuvo"}
          </h2>
        </div>
        <span className="rounded-full border border-border px-2 py-1 text-[9px] uppercase text-muted-foreground">
          {r.status}
        </span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl bg-surface-2/60 p-3">
          <strong className="block text-lg text-foreground">{predictions ?? "—"}</strong>
          <span className="text-[10px] text-muted-foreground">
            {english ? "predictions evaluated" : "prognozių įvertinta"}
          </span>
        </div>
        <div className="rounded-xl bg-surface-2/60 p-3">
          <strong className="block text-lg text-foreground">{hypotheses ?? "—"}</strong>
          <span className="text-[10px] text-muted-foreground">
            {english ? "hypotheses reviewed" : "hipotezių patikrinta"}
          </span>
        </div>
        <div className="rounded-xl bg-surface-2/60 p-3">
          <strong className="block text-lg text-foreground">{transitions ?? "—"}</strong>
          <span className="text-[10px] text-muted-foreground">
            {english ? "status changes recorded" : "būsenos pokyčių"}
          </span>
        </div>
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
        {english
          ? "Night Lab can evaluate evidence and shadow models, but it cannot silently change Today's governing model or training plan."
          : "Night Lab gali vertinti įrodymus ir shadow modelius, bet negali tyliai pakeisti Today valdančio modelio ar treniruočių plano."}
      </p>
      <Link
        to="/lab"
        className="mt-3 inline-flex min-h-11 items-center text-xs font-medium text-violet-300"
      >
        {english ? "See the laboratory record" : "Peržiūrėti laboratorijos įrašą"} →
      </Link>
    </section>
  );
}
