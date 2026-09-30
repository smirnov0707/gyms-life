import { exerciseVideo, exerciseVideoPoster } from "@/lib/exercise-media";

/**
 * What an exercise page tells a search engine it holds.
 *
 * A `VideoObject` went out on all 175 pages. Its `contentUrl` was `undefined`
 * for the 165 with no video, and `JSON.stringify` drops an undefined key — so
 * what a crawler received was a video entity carrying a name, a description and
 * a thumbnail, and nothing to play. Schema.org requires `contentUrl` or
 * `embedUrl` on a VideoObject precisely because the rest of it describes a video
 * without being one.
 *
 * The human-readable head stopped promising video on these pages. This is the
 * machine-readable copy of the same promise, and it had not.
 */

const SITE = "https://gyms.life";

export interface ExerciseForMarkup {
  slug: string;
  muscle_group?: string | null;
  equipment?: string | null;
  created_at?: string | null;
}

export interface StructuredDataNode {
  "@type": string;
  [key: string]: unknown;
}

export function exerciseStructuredData(
  exercise: ExerciseForMarkup,
  name: string,
  instructions: string,
  steps: readonly string[],
): { "@context": string; "@graph": StructuredDataNode[] } {
  const video = exerciseVideo(exercise.slug);
  const poster = exerciseVideoPoster(exercise.slug);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ExercisePlan",
        name,
        exerciseType: exercise.muscle_group,
        description: instructions,
      },
      // Only where there is something to play. A page whose demonstration is
      // two still frames describes itself with the frames or with nothing.
      ...(video
        ? [
            {
              "@type": "VideoObject",
              name: `${name} — technika`,
              description: instructions || `${name} technikos demonstracija.`,
              ...(poster ? { thumbnailUrl: `${SITE}${poster}` } : {}),
              contentUrl: `${SITE}${video}`,
              ...(exercise.created_at ? { uploadDate: exercise.created_at } : {}),
            },
          ]
        : []),
      ...(steps.length
        ? [
            {
              "@type": "HowTo",
              name: `Kaip atlikti: ${name}`,
              description: instructions,
              ...(exercise.equipment
                ? { tool: [{ "@type": "HowToTool", name: exercise.equipment }] }
                : {}),
              step: steps.map((step, index) => ({
                "@type": "HowToStep",
                position: index + 1,
                text: step,
              })),
            },
          ]
        : []),
    ],
  };
}
