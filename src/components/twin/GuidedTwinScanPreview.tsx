import { Camera, CheckCircle2, RotateCw, ShieldCheck, Video } from "lucide-react";
import { LocalTwinCameraPreview } from "@/components/twin/LocalTwinCameraPreview";
import { buildGuidedTwinScanState } from "@/lib/personalized-twin.guided-scan";
import type { PersonalizedTwinProviderCapability } from "@/lib/personalized-twin.provider";

const COPY = {
  lt: {
    eyebrow: "GUIDED 360° SCAN",
    title: "Vedamas kūno skenavimas",
    intro:
      "Būsimo personalizuoto Twin kūrimui lėtai apsisuksi prieš kamerą. Šiame etape video neįrašomas ir niekur nesiunčiamas.",
    steps: [
      "Pastatyk telefoną juosmens–krūtinės aukštyje",
      "Atsistok pilnu ūgiu kadre",
      "Lėtai apsisuk 360°",
      "Sistema patikrins, ar užfiksuotas visas kūnas",
    ],
    blocked:
      "Rekonstrukcijos provideris dar nepatvirtintas privatumo / DPA lygiu, todėl skenavimo įrašymas išjungtas.",
  },
  en: {
    eyebrow: "GUIDED 360° SCAN",
    title: "Guided body scan",
    intro:
      "For the future personalized Twin you will slowly rotate in front of the camera. At this stage no video is recorded or sent anywhere.",
    steps: [
      "Place the phone around waist-to-chest height",
      "Keep your full body inside the frame",
      "Slowly rotate 360°",
      "The system will verify full-body coverage",
    ],
    blocked:
      "The reconstruction provider has not passed the privacy / DPA gate, so scan recording stays disabled.",
  },
} as const;

export function GuidedTwinScanPreview({
  language,
  capability,
}: {
  language: "lt" | "en";
  capability: PersonalizedTwinProviderCapability | null;
}) {
  if (!capability?.captureModes.includes("guided_video")) return null;
  const copy = COPY[language];
  const state = buildGuidedTwinScanState({
    started: false,
    capturing: false,
    captured: false,
    progressPct: 0,
    cameraPermission: "unknown",
    capability,
  });
  return (
    <section
      className="mt-4 rounded-2xl border border-violet-400/20 bg-violet-400/[0.05] p-4"
      data-guided-twin-scan
    >
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-violet-400/10 text-violet-300">
          <Video aria-hidden="true" className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-300">
            {copy.eyebrow}
          </p>
          <h3 className="mt-1 text-sm font-semibold text-white">{copy.title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-neutral-400">{copy.intro}</p>
        </div>
      </div>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2">
        {copy.steps.map((step, index) => (
          <li
            key={step}
            className="flex items-start gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-neutral-300"
          >
            {index === 2 ? (
              <RotateCw aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-violet-300" />
            ) : index === 3 ? (
              <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-violet-300" />
            ) : (
              <Camera aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-violet-300" />
            )}
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <LocalTwinCameraPreview language={language} capability={capability} />
      <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3 text-xs leading-relaxed text-amber-200">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>{copy.blocked}</span>
      </div>
      <button
        type="button"
        disabled={!state.canSubmitToProvider}
        className="mt-3 min-h-11 rounded-full border border-white/10 px-4 text-xs font-semibold text-neutral-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {language === "lt" ? "Pradėti 360° skenavimą" : "Start 360° scan"}
      </button>
    </section>
  );
}
