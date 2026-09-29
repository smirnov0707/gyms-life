import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Who the code actually sends an athlete's data to, against who the privacy
 * policy says it does.
 *
 * Section 4 listed hosting, database and analytics providers, Paddle,
 * professional advisers and the authorities. It did not mention an AI provider
 * at all — and four of them receive the thing section 3 says is done with the
 * data: the profile and training context behind a generated plan, plus, through
 * five separate features, photographs of the athlete's body, their meals, a
 * supplement label and their lifting technique, and voice recordings.
 *
 * Nothing in the codebase connected the two. A provider can be added in
 * `ai-gateway.server.ts` in four lines, and no test, type or review step would
 * have asked whether the policy still described the system. This is that step.
 *
 * It anchors on what the code does — the provider adapters it constructs and
 * the parts it marks as images — rather than on a list of names kept somewhere,
 * because a list kept somewhere is the thing that went stale.
 */

const GATEWAY = path.resolve("src/lib/ai-gateway.server.ts");
const BASE_COPY = path.resolve("src/lib/i18n-extra-legal.ts");
const LOCALES = path.resolve("src/lib/i18n-locales");

/** How each model-id prefix is spelled where a person reads it. */
const PROVIDER_NAMES: Record<string, string> = {
  google: "Google",
  groq: "Groq",
  openai: "OpenAI",
  openrouter: "OpenRouter",
};

/** Every provider the gateway can route a request to, from the id union. */
function routedProviders(): string[] {
  const source = readFileSync(GATEWAY, "utf8");
  const union = /export type AiModelId =([\s\S]*?);/.exec(source)?.[1] ?? "";
  const prefixes = [...union.matchAll(/"([a-z]+)\//g)].map((match) => match[1] ?? "");
  return [...new Set(prefixes)].sort();
}

/** Every server function that hands a media part to a provider. */
function mediaSenders(): string[] {
  return readdirSync(path.resolve("src/lib"))
    .filter((name) => /\.functions\.ts$/.test(name))
    .filter((name) =>
      /type:\s*"image"/.test(readFileSync(path.join(path.resolve("src/lib"), name), "utf8")),
    )
    .sort();
}

const baseCopy = () => readFileSync(BASE_COPY, "utf8");
const localeFiles = () =>
  readdirSync(LOCALES)
    .filter((name) => /\.ts$/.test(name) && !/\.test\.ts$/.test(name))
    .map((name) => ({
      locale: name.replace(/\.ts$/, ""),
      text: readFileSync(path.join(LOCALES, name), "utf8"),
    }));

describe("the recipients the privacy policy names", () => {
  it("is measuring something, in both directions", () => {
    // A scan that stops matching passes forever, and this one reads two sides.
    expect(routedProviders()).toEqual(["google", "groq", "openai", "openrouter"]);
    expect(mediaSenders().length).toBeGreaterThanOrEqual(5);
    expect(localeFiles().length).toBeGreaterThanOrEqual(6);
  });

  it("includes every AI provider the gateway can route a request to", () => {
    const copy = baseCopy();
    const missing = routedProviders()
      .map((prefix) => PROVIDER_NAMES[prefix] ?? prefix)
      .filter((name) => !copy.includes(name));
    expect(missing).toEqual([]);
  });

  it("names them in every locale, not only the two with a copy branch", () => {
    // The six supplemental packs are what a German or Ukrainian athlete reads.
    // A recipient disclosed only in the base copy is disclosed to nobody else.
    const names = routedProviders().map((prefix) => PROVIDER_NAMES[prefix] ?? prefix);
    const gaps = localeFiles().flatMap(({ locale, text }) =>
      names.filter((name) => !text.includes(name)).map((name) => `${locale}: ${name}`),
    );
    expect(gaps).toEqual([]);
  });

  it("says that photographs and voice recordings are among what is collected", () => {
    // Five features send an image; one sends audio. Section 2 listed account,
    // profile, activity and technical data, and stopped there.
    expect(mediaSenders()).toContain("body-scan.functions.ts");
    for (const [key, words] of [
      ["lt", ["nuotraukos", "garso"]],
      ["en", ["Photos", "voice recordings"]],
    ] as const) {
      const entry = new RegExp(`"lg\\.privacy\\.li2e"[\\s\\S]*?${key}: "([^"]+)"`).exec(baseCopy());
      expect(entry?.[1] ?? "").not.toBe("");
      for (const word of words) expect(entry?.[1]?.toLowerCase()).toContain(word.toLowerCase());
    }
  });

  it("carries a date no older than the disclosures it makes", () => {
    // A policy edited without moving its date is the same defect one level up:
    // the document says when it was last true, and it was wrong about that too.
    const updated = /"lg\.privacy\.updated"[\s\S]*?en: "Last updated: ([^"]+)"/.exec(baseCopy());
    const stated = new Date(updated?.[1] ?? "");
    expect(Number.isNaN(stated.getTime())).toBe(false);
    expect(stated.getTime()).toBeGreaterThanOrEqual(new Date("2026-09-29").getTime());
  });
});
