import { z } from "zod";
/** An extracted draft, never an automatically saved set. Missing facts remain null. */
export const VoiceSetDraftSchema = z.object({
  exerciseName: z.string().trim().min(1).max(160).nullable(),
  weightKg: z.number().finite().min(0).max(1000).nullable(),
  reps: z.number().int().min(1).max(1000).nullable(),
  rpe: z.number().finite().min(0).max(10).nullable(),
  suggestedRestSeconds: z.number().int().min(0).max(1800).nullable(),
  coachFeedback: z.string().trim().max(500),
});
export type VoiceSetDraft = z.infer<typeof VoiceSetDraftSchema>;
export const VoiceLogResultSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    transcription: z.string().trim().min(1).max(2000),
    data: VoiceSetDraftSchema,
  }),
  z.object({ ok: z.literal(false), reason: z.string().trim().min(1).max(500) }),
]);
export type VoiceLogResult = z.infer<typeof VoiceLogResultSchema>;
/** Prefer WebM when available; Safari may instead provide MP4 audio. */
export function chooseAudioRecordingType(supports: (type: string) => boolean): string | null {
  return (
    ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"].find(supports) ??
    null
  );
}
