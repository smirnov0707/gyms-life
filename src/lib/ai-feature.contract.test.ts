import { describe, expect, it, vi } from "vitest";
import { VoiceSetDraftSchema, chooseAudioRecordingType } from "./voice-log.schema";
import { reserveAiRequestWithRpc } from "./ai-quota.server";
import { validateImageData, parseAudioUpload, validateAiInput } from "./ai-media.server";
describe("voice drafts and input boundaries", () => {
  const empty = {
    exerciseName: null,
    weightKg: null,
    reps: null,
    rpe: null,
    suggestedRestSeconds: null,
    coachFeedback: "",
  };
  it("missing spoken values remain null, not an example load or RPE", () =>
    expect(VoiceSetDraftSchema.parse(empty)).toEqual(empty));
  it.each([
    { weightKg: "100" },
    { weightKg: -1 },
    { rpe: 11 },
    { reps: NaN },
    { reps: 2.5 },
    { exerciseName: "" },
  ])("rejects malformed extracted values %j", (bad) =>
    expect(() => VoiceSetDraftSchema.parse({ ...empty, ...bad })).toThrow(),
  );
  it("selects an actual supported recorder format rather than forcing WebM on Safari", () => {
    expect(chooseAudioRecordingType((type) => type === "audio/mp4")).toBe("audio/mp4");
    expect(chooseAudioRecordingType(() => false)).toBeNull();
  });
  it.each([
    "https://example.invalid/photo.jpg",
    "file:///private/photo",
    "data:image/svg+xml;base64,PHN2Zy8+",
    "data:image/png;base64,AAAA",
    "data:image/png;base64,%%%",
  ])("rejects unsupported or mislabeled image input %s", (value) =>
    expect(() => validateImageData(value)).toThrow("AI_INVALID_MEDIA"),
  );
  it("does not send an image to a text-only task", () =>
    expect(() =>
      validateAiInput(
        {
          messages: [
            { role: "user", content: [{ type: "image", image: "data:image/png;base64,AAAA" }] },
          ],
        },
        false,
      ),
    ).toThrow("AI_UNSUPPORTED_MODALITY"));
  it("rejects media type mismatch and invalid audio base64", () => {
    expect(() =>
      parseAudioUpload({
        audioBase64: "data:audio/webm;base64,AQID",
        mimeType: "audio/mp4",
        language: "lt",
      }),
    ).toThrow();
    expect(() =>
      parseAudioUpload({ audioBase64: "AQI", mimeType: "audio/mp4", language: "lt" }),
    ).toThrow();
  });
  it("unavailable quota data is not reported as the user exhausting their quota", async () => {
    await expect(
      reserveAiRequestWithRpc("synthetic", async () => ({ data: null, error: null })),
    ).rejects.toThrow("AI_QUOTA_UNAVAILABLE");
  });
});
