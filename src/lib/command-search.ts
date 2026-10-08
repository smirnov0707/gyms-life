import type { ContextAction } from "./action-layer";

type Destination = "/app" | "/twin" | "/lab" | "/coach";
/** Local aliases, never user health data or a second source of navigation truth. */
export const COMMAND_KEYWORDS: Record<ContextAction["intent"] | Destination, string> = {
  workout: "training strength running treadmill workout treniruote begimas takelis sportas",
  checkin: "readiness energy recovery checkin savijauta pasiruosimas atsistatymas",
  nutrition: "food meal nutrition maistas mityba patiekalas",
  movement: "camera form scan movement biomechanika kamera judesys technika",
  coach: "coach assistant chat help treneris pokalbis pagalba",
  "/app": "today home siandien pradinis",
  "/twin": "twin body digital dvynys kunas",
  "/lab": "lab laboratory evidence laboratorija analize duomenys",
  "/coach": "coach assistant chat treneris pokalbis pagalba",
};
const normalize = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
type SearchItem = { searchLabel: string; searchDescription?: string; keywords?: string };

/** Preserve context priority; every search word must match. No logging or persistence. */
export function filterCommandItems<T extends SearchItem>(items: readonly T[], query: string): T[] {
  const words = normalize(query.trim()).split(/\s+/u).filter(Boolean);
  return items.filter((item) => {
    const text = normalize(
      [item.searchLabel, item.searchDescription, item.keywords].filter(Boolean).join(" "),
    );
    return words.every((word) => text.includes(word));
  });
}

type ShortcutEvent = Pick<
  KeyboardEvent,
  | "key"
  | "code"
  | "ctrlKey"
  | "metaKey"
  | "altKey"
  | "shiftKey"
  | "repeat"
  | "isComposing"
  | "defaultPrevented"
>;
/** Ignore IME input, key-repeat, already handled events and conflicting modifiers. */
export function isCommandShortcut(event: ShortcutEvent): boolean {
  return (
    !event.defaultPrevented &&
    !event.repeat &&
    !event.isComposing &&
    !event.altKey &&
    !event.shiftKey &&
    event.ctrlKey !== event.metaKey &&
    (event.key.toLowerCase() === "k" || event.code === "KeyK")
  );
}
