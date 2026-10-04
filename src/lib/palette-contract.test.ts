import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Onyx & Volt, and nothing left of the lavender.
 *
 * `--primary` was `#baa5ff`, a pale violet, so every `text-primary`, ring and
 * glow in the app was purple — and 24 components carried their own
 * `violet-*`/`indigo-*` utilities on top of it. The theme in `styles.css` was
 * not even the only copy: `future-lab-visual-system.css` re-declared the same
 * tokens for the Twin's dark stage, so changing the palette changed everything
 * except the screen the product is named for.
 *
 * This holds the three things that let that happen: a hardcoded hue in a
 * component, a second declaration of the palette, and an accent used for a job
 * that belongs to another one.
 */

const STYLES = path.resolve("src/styles.css");

function sources(): { file: string; text: string }[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return /\.(tsx?|css)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [full] : [];
    });
  return walk(path.resolve("src")).map((file) => ({
    file: path.relative(process.cwd(), file),
    text: readFileSync(file, "utf8"),
  }));
}

describe("the palette the app actually paints with", () => {
  it("is reading the whole of src, so this cannot pass on an empty scan", () => {
    const files = sources();
    expect(files.length).toBeGreaterThan(200);
    expect(files.some(({ file }) => file.endsWith("styles.css"))).toBe(true);
  });

  it("declares volt as the action colour and keeps the lavender out of it", () => {
    const styles = readFileSync(STYLES, "utf8");
    expect(styles).toMatch(/--primary:\s*#c8fa3c/);
    expect(styles).not.toMatch(/#baa5ff|#6543bd/);
    // Light mode cannot use volt for text: the olive beside it is the rule in
    // AGENTS.md about an accent that only reads on onyx.
    expect(styles).toMatch(/--primary:\s*#42600a/);
  });

  it("has no component painting its own purple", () => {
    // Utility classes first. A single `text-violet-300` is how the last palette
    // survived its own replacement.
    const offenders = sources()
      .filter(({ text }) =>
        /\b(?:text|bg|border|ring|from|via|to|shadow|fill|stroke)-(?:violet|indigo|purple|fuchsia)-\d{2,3}\b/.test(
          text,
        ),
      )
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it("has no literal in the violet band, whatever that literal is spelled like", () => {
    // This replaced a list of six banned hexes, and it had to: that list was
    // written from the colours the sweep had already found, so it asserted the
    // sweep had happened rather than that the app was clean. It passed over
    // `#bea3ff` in the logo on every page, `#9d83ff`, `#b19bef`, `#c3a5f5`,
    // `#a077f2` and eleven more — including four hidden behind an eight-digit
    // alpha hex, which the word boundary in the old pattern could not even
    // reach.
    //
    // So this reads the colour instead of the spelling: every hex (3, 4, 6 or 8
    // digits) and every `rgb()`/`rgba()` triple is converted to a hue, and
    // anything landing in the violet band with enough saturation to be seen is
    // an offender. A new purple cannot be introduced under a name this test has
    // not met. It is the `.from(`/`.rpc(` lesson from AGENTS.md applied to
    // colour: anchor on what the value *is*, not on what it is called.
    const toHsl = (r: number, g: number, b: number) => {
      const [rr, gg, bb] = [r / 255, g / 255, b / 255];
      const max = Math.max(rr, gg, bb);
      const min = Math.min(rr, gg, bb);
      const l = (max + min) / 2;
      if (max === min) return { h: 0, s: 0, l: l * 100 };
      const d = max - min;
      const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      const h =
        max === rr
          ? (gg - bb) / d + (gg < bb ? 6 : 0)
          : max === gg
            ? (bb - rr) / d + 2
            : (rr - gg) / d + 4;
      return { h: h * 60, s: s * 100, l: l * 100 };
    };
    // Violet through magenta, bright enough and saturated enough to read as a
    // hue rather than as a near-neutral tint of one.
    const isViolet = (r: number, g: number, b: number) => {
      const { h, s, l } = toHsl(r, g, b);
      return h >= 250 && h <= 330 && s > 20 && l > 20 && l < 92;
    };

    const found: string[] = [];
    let literalsRead = 0;
    for (const { file, text } of sources()) {
      for (const [literal, group] of text.matchAll(/#([0-9a-fA-F]{3,8})\b/g)) {
        const digits = group ?? "";
        const rgb =
          digits.length === 3 || digits.length === 4
            ? [...digits.slice(0, 3)].map((c) => parseInt(c + c, 16))
            : digits.length === 6 || digits.length === 8
              ? [0, 2, 4].map((at) => parseInt(digits.slice(at, at + 2), 16))
              : null;
        if (!rgb) continue;
        literalsRead += 1;
        if (isViolet(rgb[0]!, rgb[1]!, rgb[2]!)) found.push(`${file}: ${literal}`);
      }
      for (const [, r, g, b] of text.matchAll(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/g)) {
        literalsRead += 1;
        if (isViolet(Number(r), Number(g), Number(b))) found.push(`${file}: rgb(${r} ${g} ${b})`);
      }
    }
    // The scan has to still be finding colours at all, or it passes on nothing.
    expect(literalsRead).toBeGreaterThan(300);
    expect(found).toEqual([]);
  });

  it("keeps one declaration of each palette token, except where a dark stage says why", () => {
    // `future-lab-visual-system.css` redeclares tokens for the Twin's canvas,
    // which AGENTS.md permits — a camera feed, a media player, the Twin — and
    // that block has to say so in words beside it.
    const redeclaring = sources().filter(
      ({ file, text }) => file !== "src/styles.css" && /--primary:\s*#/.test(text),
    );
    for (const { file, text } of redeclaring) {
      expect(text, file).toMatch(/dark (?:media )?stages?|dark stage/i);
      // And it must redeclare the current palette, not a palette from before.
      expect(text, file).toMatch(/--primary:\s*#c8fa3c/);
    }
  });

  it("gives the three accents three jobs, with distinct values", () => {
    const styles = readFileSync(STYLES, "utf8");
    const dark = styles.slice(styles.indexOf(":root {"), styles.indexOf(".dark {"));
    const value = (token: string) =>
      new RegExp(`--${token}:\\s*(#[0-9a-f]{6})`, "i").exec(dark)?.[1]?.toLowerCase() ?? "";
    const accents = ["primary", "accent", "ember", "destructive"].map(value);
    expect(accents.every(Boolean)).toBe(true);
    expect(new Set(accents).size).toBe(accents.length);
  });

  it("keeps the error colour for errors, not for readings an athlete may dislike", () => {
    // `--destructive` is the delete-account button and "the account could not
    // be deleted". It was also a resting heart rate 2 bpm up, a readiness of
    // 54, and a bench press trending down — so the one colour that should mean
    // "something broke" also meant "a number moved the way you did not want".
    // An athlete cannot tell those apart, and this app's claim is that it
    // reports rather than editorialises. Ember is the attention colour.
    //
    // Anchored on what the code does, not on a file list: any `destructive`
    // chosen by a comparison against a measurement is the shape being banned.
    const offenders: string[] = [];
    let scanned = 0;
    for (const { file, text } of sources()) {
      if (!file.endsWith(".tsx")) continue;
      for (const [line] of text.matchAll(/^.*destructive.*$/gm)) {
        scanned += 1;
        // A ternary or comparison picking `destructive` from a number, a trend
        // or a score — rather than from a failure, a rejection or an error.
        if (
          /(?:score|delta|trend|value|good|level|percent|ratio|count)\b[^;\n]{0,80}destructive/i.test(
            line,
          ) &&
          !/error|fail|reject|invalid|unavailable|destroy|delete|danger/i.test(line)
        )
          offenders.push(`${file}: ${line.trim().slice(0, 100)}`);
      }
    }
    // The scan has to still be reading `destructive` lines at all.
    expect(scanned).toBeGreaterThan(10);
    expect(offenders).toEqual([]);
  });

  it("has an ember token that actually resolves to a utility", () => {
    // `text-ember` only exists because `--color-ember` is declared in the
    // `@theme inline` block. The three measurement colours above depend on it,
    // and a token removed from that block fails silently as an unstyled class.
    const styles = readFileSync(STYLES, "utf8");
    const theme = styles.slice(styles.indexOf("@theme inline"));
    expect(theme).toMatch(/--color-ember:\s*var\(--ember\)/);
    expect(sources().some(({ text }) => /\btext-ember\b/.test(text))).toBe(true);
  });

  it("sets numbers in tabular figures, so an instrument does not jitter", () => {
    // A weight going 95 → 100 must not shift the layout mid-set.
    const design = readFileSync(path.resolve("src/ui-design-system.css"), "utf8");
    expect(design).toMatch(/font-variant-numeric: tabular-nums/);
    expect(design).toMatch(/\.fl-metric\b/);
    expect(design).toMatch(/\.fl-display\b/);
  });

  it("asks no third party for a font, and does not keep a policy saying it may", () => {
    // Both faces are self-hosted under the OFL with their licences beside
    // them, which is also why the athletic voice is weight and tracking rather
    // than a third typeface.
    //
    // The pair, and the reason a first version of this test failed on code that
    // was already correct: it searched for the hostname and found it in the
    // Content-Security-Policy, where it was a *permission* rather than a
    // request. A permission for a request nothing makes is still worth closing,
    // so this now asserts both halves — no third-party font is fetched, and the
    // policy no longer admits one.
    const faces = readFileSync(path.resolve("src/fonts.css"), "utf8");
    expect(faces).toMatch(/@font-face/);
    // Anchor on the fetch: every `src: url(...)` in a face has to be local.
    const urls = [...faces.matchAll(/src:\s*url\(\s*["']?([^"')]+)/g)].map(([, href]) => href);
    expect(urls.length).toBeGreaterThan(1);
    for (const href of urls) expect(href).toMatch(/^\/fonts\//);

    for (const { file, text } of sources()) {
      // A stylesheet or document that pulls a face from somewhere else, rather
      // than a string that merely names a font host.
      expect(text, file).not.toMatch(/@import\s+url\(/);
      expect(text, file).not.toMatch(
        /(?:href|src)[=:]\s*["'`]https?:\/\/(?:fonts\.googleapis\.com|fonts\.gstatic\.com)/,
      );
    }

    const policy = readFileSync(path.resolve("src/lib/security-headers.server.ts"), "utf8");
    const directive = (name: string) =>
      new RegExp(`"${name} ([^"]*)"`).exec(policy)?.[1] ?? "__missing__";
    expect(directive("font-src")).not.toMatch(/fonts\.gstatic\.com/);
    expect(directive("style-src")).not.toMatch(/fonts\.googleapis\.com/);
    // And the directives are still there to be read: a typo in either name
    // above would otherwise pass this for the rest of the project's life.
    expect(directive("font-src")).toMatch(/'self'/);
    expect(directive("style-src")).toMatch(/'self'/);
  });
});
