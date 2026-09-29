import { ShieldCheck } from "lucide-react";
import { baseLang, useI18n } from "@/lib/i18n";

/**
 * What happens to a photo or a recording, said where it is taken.
 *
 * Five surfaces send an image to an AI provider — the body scan, the meal
 * photo, a supplement label, and two form analyses — and one sends audio.
 * None of them said so. The Twin's own capture screens say the opposite about
 * themselves, correctly: "these photos remain only on this device and are not
 * uploaded", "the photos are not sent anywhere". An athlete who has read that
 * has been taught what this app does with a camera, and then photographs their
 * body somewhere the same promise does not hold.
 *
 * The privacy policy now names the providers, which is where a regulator
 * looks. This is where the athlete looks: the moment before they press the
 * button.
 */

export type AiMediaKind = "photo" | "audio";

const COPY: Record<"lt" | "en", Record<AiMediaKind, string>> = {
  lt: {
    photo:
      "Nuotrauka siunčiama analizei dirbtinio intelekto paslaugos teikėjui. Išsaugomas tik rezultatas — pati nuotrauka nesaugoma.",
    audio:
      "Įrašas siunčiamas transkripcijai dirbtinio intelekto paslaugos teikėjui. Išsaugomas tik tekstas — pats įrašas nesaugomas.",
  },
  en: {
    photo:
      "The photo is sent to an AI provider for analysis. Only the result is saved — the photo itself is not stored.",
    audio:
      "The recording is sent to an AI provider for transcription. Only the text is saved — the recording itself is not stored.",
  },
};

export function AiMediaDisclosure({
  kind = "photo",
  className = "",
}: {
  kind?: AiMediaKind;
  className?: string;
}) {
  const { lang } = useI18n();
  return (
    <p
      className={`flex items-start gap-2 text-xs leading-5 text-muted-foreground ${className}`.trim()}
    >
      <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{COPY[baseLang(lang)][kind]}</span>
    </p>
  );
}

export default AiMediaDisclosure;
