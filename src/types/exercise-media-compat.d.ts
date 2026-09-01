declare module "@/lib/exercise-media" {
  export function exerciseVideo(slug: string, muscleGroup?: string | null, equipment?: string | null): string;
  export function exerciseVideoPoster(slug: string, muscleGroup?: string | null, equipment?: string | null): string;
}
