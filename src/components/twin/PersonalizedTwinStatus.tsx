import { CircleAlert, CircleCheck, LoaderCircle, LockKeyhole, ScanLine } from "lucide-react";
import type { PersonalizedTwinUiPhase } from "@/lib/personalized-twin.presentation";

const COPY = {
  lt: {
    collecting: ["Vietinis paruošimas", "Užbaik kadrus ir sutikimą. Duomenys niekur nesiunčiami."],
    local_ready: [
      "Paruošta pateikimui",
      "Lokalus rinkinys paruoštas. Išorinis apdorojimas vykdomas tik po visų patvirtinimų.",
    ],
    provider_blocked: [
      "Išorinis apdorojimas užrakintas",
      "Provideris dar nepatvirtintas. Nuotraukos lieka lokaliai.",
    ],
    processing: [
      "Kuriamas vizualinis avataras",
      "Vyksta 3D rekonstrukcija. Tai nėra medicininis ar anatominis skenavimas.",
    ],
    ready: [
      "Vizualinis avataras paruoštas",
      "Modelis paruoštas kaip Identity Shell, ne kūno metrikų tiesos šaltinis.",
    ],
    failed: [
      "Rekonstrukcija nepavyko",
      "Galima bandyti dar kartą. Nepavykę raw input turi būti išvalyti prieš terminalinę būseną.",
    ],
  },
  en: {
    collecting: ["Local preparation", "Finish the views and consent. Nothing is sent externally."],
    local_ready: [
      "Ready to submit",
      "The local set is ready. External processing happens only after all approvals.",
    ],
    provider_blocked: [
      "External processing locked",
      "The provider is not approved yet. Photos stay local.",
    ],
    processing: [
      "Building visual avatar",
      "3D reconstruction is in progress. This is not a medical or anatomical scan.",
    ],
    ready: [
      "Visual avatar ready",
      "The model is an Identity Shell, not a source of truth for body metrics.",
    ],
    failed: [
      "Reconstruction failed",
      "You can retry. Failed raw input must be cleaned before a terminal state.",
    ],
  },
} as const;

export function PersonalizedTwinStatus({
  language,
  phase,
}: {
  language: "lt" | "en";
  phase: PersonalizedTwinUiPhase;
}) {
  const [title, detail] = COPY[language][phase];
  const Icon =
    phase === "ready"
      ? CircleCheck
      : phase === "processing"
        ? LoaderCircle
        : phase === "failed"
          ? CircleAlert
          : phase === "provider_blocked"
            ? LockKeyhole
            : ScanLine;
  return (
    <div
      data-personalized-twin-status={phase}
      className="mt-3 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3"
    >
      <Icon
        aria-hidden="true"
        className={`mt-0.5 size-4 shrink-0 ${phase === "processing" ? "animate-spin" : ""}`}
      />
      <div>
        <p className="text-xs font-semibold text-white">{title}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">{detail}</p>
      </div>
    </div>
  );
}
