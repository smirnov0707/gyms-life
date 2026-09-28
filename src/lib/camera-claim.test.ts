import { describe, expect, it, vi } from "vitest";
import { claimOpenedCamera, stopCameraStream } from "./camera-claim";

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

  it("stops every track, because one live track is a lit camera", () => {
    const stopA = vi.fn();
    const stopB = vi.fn();
    stopCameraStream({ getTracks: () => [{ stop: stopA }, { stop: stopB }] } as unknown as Pick<
      MediaStream,
      "getTracks"
    >);
    expect(stopA).toHaveBeenCalledTimes(1);
    expect(stopB).toHaveBeenCalledTimes(1);
  });

  it("closes a camera retired at any point in a multi-step open", () => {
    // The body composition scanner has the longest window of the three: a
    // high-resolution request, a plainer one if that is refused, then
    // `applyConstraints` to zoom out. Every await in it is a chance for the
    // athlete to leave, and only the final claim decides.
    const { stop, stream } = trackedStream();
    expect(claimOpenedCamera(stream, { openedFor: 1, current: 5 })).toBeNull();
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
