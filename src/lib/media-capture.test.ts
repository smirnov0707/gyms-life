import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { claimOpenedCapture, stopCaptureStream } from "./media-capture";

const trackedStream = () => {
  const stop = vi.fn();
  return {
    stop,
    stream: { getTracks: () => [{ stop }] } as unknown as Pick<MediaStream, "getTracks">,
  };
};

describe("a capture device that finished opening after the screen was left", () => {
  it("hands over a stream the caller is still waiting for", () => {
    const { stop, stream } = trackedStream();
    expect(claimOpenedCapture(stream, true)).toBe(stream);
    expect(stop).not.toHaveBeenCalled();
  });

  it("closes a stream nobody is waiting for any more", () => {
    // The defect this module exists for. `getUserMedia` resolves after a
    // permission prompt and a device start-up, and two screens assigned
    // whatever came back. Unmount during that window and the stream landed in
    // a component with no cleanup left to run: the camera light stayed on
    // after the athlete had left the page that asked for it.
    const { stop, stream } = trackedStream();
    expect(claimOpenedCapture(stream, false)).toBeNull();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("stops every track, because one live track is a lit camera", () => {
    const stopA = vi.fn();
    const stopB = vi.fn();
    stopCaptureStream({ getTracks: () => [{ stop: stopA }, { stop: stopB }] } as unknown as Pick<
      MediaStream,
      "getTracks"
    >);
    expect(stopA).toHaveBeenCalledTimes(1);
    expect(stopB).toHaveBeenCalledTimes(1);
  });

  it("tolerates being asked to stop nothing", () => {
    // Cleanups run whether or not a device ever opened.
    expect(() => stopCaptureStream(null)).not.toThrow();
  });

  it("never returns a stream it has closed, and never drops a live one", () => {
    // The two halves must not come apart: a closed stream handed back is a
    // dead preview the athlete cannot restart, and a live one dropped is the
    // leak itself.
    for (const stillWanted of [true, false]) {
      const { stop, stream } = trackedStream();
      const claimed = claimOpenedCapture(stream, stillWanted);
      expect(claimed === null).toBe(stop.mock.calls.length === 1);
    }
  });
});

/**
 * The leak was found twice in one sitting, in two screens written months apart,
 * and the third, fourth and fifth had each solved it privately in their own
 * way. That is the shape of a rule that needs enforcing rather than
 * remembering, so the ownership decision has one home and every call site is
 * held to it here.
 */
describe("every screen that opens a camera or microphone", () => {
  const SRC = path.resolve("src");

  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
    });

  const captureSites = () =>
    walk(SRC)
      .map((file) => ({ file, text: readFileSync(file, "utf8") }))
      .filter(
        ({ file, text }) => /getUserMedia\s*\(/.test(text) && !file.endsWith("media-capture.ts"),
      );

  const relative = (file: string) => path.relative(SRC, file).split(path.sep).join("/");

  it("decides ownership through this module rather than privately", () => {
    // Importing it is what makes the decision reviewable in one place. A file
    // that opens a device and never mentions this module has, by definition,
    // written its own answer.
    const unguarded = captureSites()
      .filter(({ text }) => !/from "@\/lib\/media-capture"|from "\.\/media-capture"/.test(text))
      .map(({ file }) => relative(file));
    expect(unguarded).toEqual([]);
  });

  it("stops tracks through this module rather than by hand", () => {
    // `getTracks().forEach(stop)` written inline is how the loops drifted apart
    // in the first place — twelve of them across five files, and two were
    // reached only when the device had already opened.
    const handRolled = captureSites()
      .filter(({ text }) => /getTracks\(\)\s*\.\s*forEach/.test(text))
      .map(({ file }) => relative(file));
    expect(handRolled).toEqual([]);
  });

  it("is actually watching the screens it claims to watch", () => {
    // A scan that silently matches nothing passes forever. These are the five
    // known surfaces; the count may grow, but it must never fall to zero.
    expect(captureSites().length).toBeGreaterThanOrEqual(5);
  });
});
