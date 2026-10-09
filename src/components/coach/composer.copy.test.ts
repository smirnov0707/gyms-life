import { describe, expect, it } from "vitest";
import { baseLang } from "@/lib/i18n";
import { SupportedLanguageSchema } from "@/lib/language.schema";
import { coachComposerCopy } from "./composer.copy";

describe("composer locale fallback", () => {
  it.each(SupportedLanguageSchema.options)("explains intentional sending in %s", (language) => {
    const labels = coachComposerCopy(language);
    expect(labels.newline).toBe(
      baseLang(language) === "lt" ? "Enter – nauja eilutė." : "Enter for a new line.",
    );
    expect(labels.shortcut).toContain("Ctrl / ⌘ + Enter");
    expect(labels.length(1001)).toContain("1001");
    expect(labels.length(1001)).toContain("1000");
  });
});
