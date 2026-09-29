import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every screen that sends a photo or a recording off the device says so.
 *
 * Six server functions put an image or an audio part into a provider request:
 * the body scan, the meal photo, a supplement label, two form analyses and the
 * voice set logger. None of the screens that call them mentioned it. The Twin's
 * own capture screens say the opposite about themselves, and truthfully —
 * "these photos remain only on this device and are not uploaded", "the photos
 * are not sent anywhere" — so an athlete has been taught what this app does
 * with a camera before they ever reach the one that photographs their body.
 *
 * The privacy policy names the providers; that is where a regulator looks. This
 * is where the athlete looks, in the second before pressing the button.
 *
 * The scan is anchored on the media part in the request, not on a list of
 * screens: a seventh feature that sends an image is exactly the thing a list
 * would not know about.
 */

const LIB = path.resolve("src/lib");
const SURFACES = [path.resolve("src/components"), path.resolve("src/routes")];

const MEDIA_PART = /type:\s*"image"|audioBase64/;

/** `{ module, exportName }` for every server function that sends media. */
function mediaSenders(): { module: string; name: string }[] {
  return readdirSync(LIB)
    .filter((file) => /\.functions\.ts$/.test(file) && !/\.test\./.test(file))
    .flatMap((file) => {
      const source = readFileSync(path.join(LIB, file), "utf8");
      // Split on each exported server function so a module that also holds
      // ordinary reads — `smart.functions.ts` does — does not tar them all.
      return source
        .split(/(?=export const \w+ = createServerFn)/)
        .map((region) => {
          const name = /export const (\w+) = createServerFn/.exec(region)?.[1];
          return name && MEDIA_PART.test(region)
            ? { module: file.replace(/\.ts$/, ""), name }
            : null;
        })
        .filter((entry): entry is { module: string; name: string } => entry !== null);
    });
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name) ? [full] : [];
  });
}

/** Files that import one of those functions by name. */
function callers(): { file: string; calls: string[]; text: string }[] {
  const senders = mediaSenders();
  return SURFACES.flatMap(walk)
    .map((file) => {
      const text = readFileSync(file, "utf8");
      const calls = senders
        .filter(
          (sender) => new RegExp(`\\b${sender.name}\\b`).test(text) && text.includes(sender.module),
        )
        .map((sender) => sender.name);
      return { file: path.relative(process.cwd(), file), calls, text };
    })
    .filter((entry) => entry.calls.length > 0);
}

describe("the screens that send a photo or a recording to a provider", () => {
  it("are found by what the request carries, not by a list of screens", () => {
    // A scan that quietly matches nothing passes forever, and this one has two
    // halves that can each fall silent.
    const senders = mediaSenders();
    expect(senders.map((sender) => sender.name).sort()).toEqual([
      "analyzeBodyScan",
      "analyzeExerciseForm",
      "analyzeForm",
      "analyzeMealPhoto",
      "analyzeSupplementPhoto",
      "parseVoiceWorkoutLog",
    ]);
    expect(callers().length).toBeGreaterThanOrEqual(6);
  });

  it("all tell the athlete before they press the button", () => {
    const silent = callers()
      .filter(({ text }) => !text.includes("AiMediaDisclosure"))
      .map(({ file, calls }) => `${file} (${calls.join(", ")})`);
    expect(silent).toEqual([]);
  });

  it("say it from one place, so six screens cannot drift into six promises", () => {
    const disclosure = readFileSync(path.resolve("src/components/AiMediaDisclosure.tsx"), "utf8");
    // Photo and audio are different claims about different things; one string
    // for both would be the union-with-one-answer defect again.
    expect(/photo:\s*\n?\s*"/.test(disclosure)).toBe(true);
    expect(/audio:\s*\n?\s*"/.test(disclosure)).toBe(true);
    const values = [...disclosure.matchAll(/"([^"]{40,})"/g)].map((match) => match[1] ?? "");
    expect(new Set(values).size).toBe(values.length);
  });

  it("does not claim the photo is kept, because it is not", () => {
    // Only the derived numbers are written — `body_metrics` for the scan, a
    // meal row for the photo. If that ever changes, this sentence becomes the
    // lie the whole file exists to prevent.
    const scan = readFileSync(path.join(LIB, "body-scan.functions.ts"), "utf8");
    expect(scan).not.toMatch(/\.storage\b|\.upload\(/);
    const vision = readFileSync(path.join(LIB, "food-vision.functions.ts"), "utf8");
    expect(vision).not.toMatch(/\.storage\b|\.upload\(/);
  });
});
