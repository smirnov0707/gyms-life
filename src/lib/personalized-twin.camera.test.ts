import { describe, expect, it, vi } from "vitest";
import { closeLocalTwinCamera, openLocalTwinCamera } from "./personalized-twin.camera";

describe("Personalized Twin local camera", () => {
  it("opens video only and never requests audio", async () => {
    const stream = { getTracks: () => [] } as unknown as MediaStream;
    const getUserMedia = vi.fn(async () => stream);

    await expect(openLocalTwinCamera({ getUserMedia })).resolves.toBe(stream);
    expect(getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: "user" },
      audio: false,
    });
  });

  it("fails closed when browser camera access is unavailable", async () => {
    await expect(openLocalTwinCamera(undefined)).rejects.toThrow(
      "PERSONALIZED_TWIN_CAMERA_UNAVAILABLE",
    );
  });
  it("stops every active track when the local preview closes", () => {
    const stopA = vi.fn();
    const stopB = vi.fn();
    const stream = {
      getTracks: () => [{ stop: stopA }, { stop: stopB }],
    } as unknown as Pick<MediaStream, "getTracks">;

    closeLocalTwinCamera(stream);
    expect(stopA).toHaveBeenCalledTimes(1);
    expect(stopB).toHaveBeenCalledTimes(1);
  });
});
