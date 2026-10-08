import { describe, it, expect } from "vitest";
import { filterCommandItems, isCommandShortcut, COMMAND_KEYWORDS } from "./command-search";
import { CONTEXT_ACTIONS, contextualActionsFor } from "./action-layer";

const items = [
  {
    id: "training",
    searchLabel: "Pradėti treniruotę",
    searchDescription: "Tęsti šiandienos planą",
    keywords: "running strength",
  },
  { id: "body", searchLabel: "MY TWIN", keywords: "dvynys kūnas" },
  { id: "coach", searchLabel: "Ask Coach", searchDescription: "One conversation" },
];
const keyboard = {
  key: "k",
  code: "KeyK",
  ctrlKey: true,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  repeat: false,
  isComposing: false,
  defaultPrevented: false,
};
describe("local command search", () => {
  it.each(["", "  ", "\n\t"])("preserves order for blank input %j", (query) => {
    expect(filterCommandItems(items, query)).toEqual(items);
  });
  it.each(["treniruotė", "treniruote", "TRENIRUOTĘ", "pradeti plana", "running"])(
    "finds localized labels or aliases: %s",
    (query) => {
      expect(filterCommandItems(items, query).map((item) => item.id)).toEqual(["training"]);
    },
  );
  it("requires every word", () => expect(filterCommandItems(items, "running coach")).toEqual([]));
  it("matches Lithuanian combining characters", () =>
    expect(filterCommandItems(items, "ku\u0304nas").map((item) => item.id)).toEqual(["body"]));
  it("does not mutate inputs or return executable actions", () => {
    const before = JSON.stringify(items);
    expect(filterCommandItems(items, "coach")[0]).toBe(items[2]);
    expect(JSON.stringify(items)).toBe(before);
  });
  it.each(["today", "twin", "lab", "coach"] as const)(
    "keeps the original context defaults in %s",
    (world) => {
      const actions = contextualActionsFor(world).map((action) => ({
        ...action,
        searchLabel: action.label,
        keywords: COMMAND_KEYWORDS[action.intent],
      }));
      expect(filterCommandItems(actions, "").map((item) => item.intent)).toEqual(
        actions.map((item) => item.intent),
      );
    },
  );
  it("has an alias entry for every existing intent", () => {
    for (const action of CONTEXT_ACTIONS)
      expect(COMMAND_KEYWORDS[action.intent].length).toBeGreaterThan(0);
  });
});
describe("command shortcut", () => {
  it("supports Control K", () => expect(isCommandShortcut(keyboard)).toBe(true));
  it("supports Command K", () =>
    expect(isCommandShortcut({ ...keyboard, ctrlKey: false, metaKey: true })).toBe(true));
  it("supports physical K in another keyboard layout", () =>
    expect(isCommandShortcut({ ...keyboard, key: "л" })).toBe(true));
  it.each(["altKey", "shiftKey", "repeat", "isComposing", "defaultPrevented"] as const)(
    "ignores %s",
    (field) => expect(isCommandShortcut({ ...keyboard, [field]: true })).toBe(false),
  );
  it("does not capture ordinary typing", () =>
    expect(isCommandShortcut({ ...keyboard, ctrlKey: false })).toBe(false));
  it("ignores two primary modifiers", () =>
    expect(isCommandShortcut({ ...keyboard, metaKey: true })).toBe(false));
  it("ignores a different key", () =>
    expect(isCommandShortcut({ ...keyboard, key: "p", code: "KeyP" })).toBe(false));
});
