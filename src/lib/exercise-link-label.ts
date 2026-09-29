import { baseLang, type Lang } from "@/lib/i18n";
import { getExerciseMedia, type MediaType } from "@/lib/exercise-media";

/**
 * What the button that opens an exercise page is allowed to promise.
 *
 * The generated-workout list labelled every one of them "Žiūrėti video" /
 * "Watch video". Ten of the 175 exercises have a video; the other 165 open onto
 * two still frames. So an athlete told to watch a video for a barbell shrug
 * taps through and finds `Kadras 1` / `Kadras 2` — the page is honest, the
 * button that sent them there was not, and a label is the only part of this
 * anybody reads before deciding whether to tap.
 *
 * `Record<MediaType, string>` per language makes the compiler ask for all three
 * answers; the test asks that they differ, which it cannot.
 */
const LABELS: Record<"lt" | "en", Record<MediaType, string>> = {
  lt: {
    video: "Žiūrėti video",
    frames: "Žiūrėti techniką",
    fallback: "Apie pratimą",
  },
  en: {
    video: "Watch video",
    frames: "View technique",
    fallback: "About this exercise",
  },
};

/**
 * The label for a link to one exercise page.
 *
 * A slug the catalogue does not have — an AI-generated block naming something
 * that was never seeded — resolves to `fallback`, which promises no
 * demonstration at all rather than the wrong one.
 */
export function exerciseLinkLabel(lang: Lang, slug: string): string {
  return LABELS[baseLang(lang)][getExerciseMedia(slug).type];
}
