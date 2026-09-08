import { baseLang, useI18n } from "@/lib/i18n";

/** One fixed illustration: horizon and athlete measurements never alter it. */
export function IllustrativeAthlete({ compact = false }: { compact?: boolean }) {
  const { lang } = useI18n();
  const english = baseLang(lang) === "en";
  return (
    <figure
      className={`fl-illustrative-athlete relative flex min-w-0 flex-col items-center ${compact ? "" : "self-center"}`}
    >
      <div
        className="pointer-events-none absolute inset-x-[12%] bottom-9 h-16 rounded-full bg-violet-500/10 blur-2xl"
        aria-hidden="true"
      />
      <img
        src="/assets/future-lab/reference-athlete-v1.png"
        alt={english ? "Illustrative athlete" : "Iliustracinis atletas"}
        loading={compact ? "lazy" : "eager"}
        decoding="async"
        className={`relative w-auto max-w-full object-contain drop-shadow-[0_0_24px_rgba(102,75,210,.15)] ${compact ? "h-[104px]" : "h-[238px] sm:h-[330px] lg:h-[410px]"}`}
      />
      <figcaption
        className={`relative mt-1.5 max-w-[250px] text-center leading-snug text-muted-foreground ${compact ? "text-[8px]" : "text-[9px]"}`}
      >
        {english
          ? "Illustrative body · not a body-shape prediction"
          : "Iliustracinis kūnas · tai nėra kūno formos prognozė"}
      </figcaption>
    </figure>
  );
}
