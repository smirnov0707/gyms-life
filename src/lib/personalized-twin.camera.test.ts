import { describe, expect, it, vi } from "vitest";
import {
  claimOpenedCamera,
  closeLocalTwinCamera,
  openLocalTwinCamera,
} from "./personalized-twin.camera";

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

describe("a camera that finished opening after the screen was left", () => {
  const trackedStream = () => {
    const stop = vi.fn();
    return {
      stop,
      stream: { getTracks: () => [{ stop }] } as unknown as Pick<MediaStream, "getTracks">,
    };
  };

  it("hands over a camera the current attempt is still waiting for", () => {
    const { stop, stream } = trackedStream();
    expect(claimOpenedCamera(stream, { openedFor: 3, current: 3 })).toBe(stream);
    expect(stop).not.toHaveBeenCalled();
  });

  it("closes a camera whose attempt has been retired", () => {
    // The defect. `getUserMedia` resolves after a permission prompt and a
    // device start-up, and the preview assigned whatever came back. Unmount
    // during that window and the stream landed in a component with no cleanup
    // left to run: the camera light stayed on after the athlete had left the
    // page that asked for it.
    const { stop, stream } = trackedStream();
    expect(claimOpenedCamera(stream, { openedFor: 3, current: 4 })).toBeNull();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("never returns a camera it has closed", () => {
    // The two must not come apart: a closed stream handed back would be a dead
    // preview the athlete cannot restart, and a live one dropped would be the
    // leak itself.
    for (const [openedFor, current] of [
      [0, 0],
      [1, 2],
      [2, 1],
      [7, 9],
    ] as const) {
      const { stop, stream } = trackedStream();
      const claimed = claimOpenedCamera(stream, { openedFor, current });
      expect(claimed === null).toBe(stop.mock.calls.length === 1);
    }
  });
});
