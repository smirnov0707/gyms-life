import { baseLang, type Lang } from "@/lib/i18n";

export function coachComposerCopy(language: Lang) {
  return baseLang(language) === "lt"
    ? {
        newline: "Enter – nauja eilutė.",
        shortcut: "Ctrl / ⌘ + Enter – siųsti.",
        length: (used: number) => `Klausimo ilgis: ${used} iš 1000.`,
      }
    : {
        newline: "Enter for a new line.",
        shortcut: "Ctrl / ⌘ + Enter to send.",
        length: (used: number) => `Question length: ${used} of 1000.`,
      };
}
