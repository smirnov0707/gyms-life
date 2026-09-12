import { describe, expect, it, vi } from "vitest";
import { persistPersonalizedTwinCaptureSet } from "./personalized-twin.capture.service";

const file = (angle: "front" | "side" | "back", value: number) => ({
  angle,
  bytes: new Uint8Array([value, value + 1, value + 2]),
  contentType: "image/jpeg" as const,
});

const setup = () => {
  const persistence = {
    createCaptureSet: vi.fn().mockResolvedValue({ id: "set-1" }),
    addImageMetadata: vi.fn().mockResolvedValue(undefined),
    markReadyForProvider: vi.fn().mockResolvedValue(undefined),
    deleteCaptureSet: vi.fn().mockResolvedValue(undefined),
  };
  const storage = {
    put: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  return { persistence, storage };
};

describe("Personalized Twin capture persistence", () => {
  it("fails closed before persistence when no provider is available", async () => {
    const { persistence, storage } = setup();
    await expect(
      persistPersonalizedTwinCaptureSet({
        userId: "user-1",
        consentGranted: true,
        providerAvailable: false,
        files: [file("front", 1), file("side", 2), file("back", 3)],
        persistence,
        storage,
      }),
    ).rejects.toThrow("PERSONALIZED_TWIN_PROVIDER_UNAVAILABLE");
    expect(persistence.createCaptureSet).not.toHaveBeenCalled();
    expect(storage.put).not.toHaveBeenCalled();
  });

  it("persists exactly three owned views and marks the set ready", async () => {
    const { persistence, storage } = setup();
    const result = await persistPersonalizedTwinCaptureSet({
      userId: "user-1",
      consentGranted: true,
      providerAvailable: true,
      files: [file("back", 3), file("front", 1), file("side", 2)],
      persistence,
      storage,
      now: () => new Date("2026-09-11T05:00:00Z"),
    });
    expect(storage.put).toHaveBeenCalledTimes(3);
    expect(persistence.addImageMetadata).toHaveBeenCalledTimes(3);
    expect(persistence.markReadyForProvider).toHaveBeenCalledWith({
      captureSetId: "set-1",
      userId: "user-1",
    });
    expect(Object.keys(result.objectPaths).sort()).toEqual(["back", "front", "side"]);
    expect(
      persistence.addImageMetadata.mock.calls.every(([arg]) => /^[0-9a-f]{64}$/.test(arg.sha256)),
    ).toBe(true);
  });

  it("removes uploaded objects and the capture set if any step fails", async () => {
    const { persistence, storage } = setup();
    storage.put.mockRejectedValueOnce(new Error("upload failed"));
    await expect(
      persistPersonalizedTwinCaptureSet({
        userId: "user-1",
        consentGranted: true,
        providerAvailable: true,
        files: [file("front", 1), file("side", 2), file("back", 3)],
        persistence,
        storage,
      }),
    ).rejects.toThrow("upload failed");
    expect(storage.remove).toHaveBeenCalledWith([]);
    expect(persistence.deleteCaptureSet).toHaveBeenCalledWith({
      captureSetId: "set-1",
      userId: "user-1",
    });
  });
});
