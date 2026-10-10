import { describe, expect, it } from "vitest";
import { coachComposerHeight, isCoachSubmitShortcut } from "./composer.model";

const key = {
  key: "Enter",
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  repeat: false,
  isComposing: false,
  keyCode: 13,
  defaultPrevented: false,
};
describe("explicit Coach composer submission", () => {
  it("keeps plain Enter and Shift+Enter for writing", () => {
    expect(isCoachSubmitShortcut(key)).toBe(false);
    expect(isCoachSubmitShortcut({ ...key, shiftKey: true })).toBe(false);
  });
  it.each(["ctrlKey", "metaKey"] as const)("requires the explicit %s shortcut", (modifier) => {
    expect(isCoachSubmitShortcut({ ...key, [modifier]: true })).toBe(true);
  });
  it.each(["shiftKey", "altKey", "repeat", "isComposing", "defaultPrevented"] as const)(
    "does not submit a %s event",
    (property) => {
      expect(isCoachSubmitShortcut({ ...key, ctrlKey: true, [property]: true })).toBe(false);
    },
  );
  it("respects the composition session even when native flags lag", () => {
    expect(isCoachSubmitShortcut({ ...key, metaKey: true }, true)).toBe(false);
  });
  it("ignores the IME boundary key even if composition already ended", () => {
    expect(isCoachSubmitShortcut({ ...key, ctrlKey: true, keyCode: 229 })).toBe(false);
  });
  it.each(["a", "Escape", "Tab", " "])("leaves %s to the browser", (value) => {
    expect(isCoachSubmitShortcut({ ...key, ctrlKey: true, key: value })).toBe(false);
  });
});

describe("bounded rendered-font textarea sizing", () => {
  it("keeps two full lines rather than a fixed one-line input", () => {
    expect(coachComposerHeight(0, 24, 20, 0)).toEqual({ height: 68, overflowing: false });
  });
  it("grows with content", () => {
    expect(coachComposerHeight(116, 24, 20, 2)).toEqual({ height: 118, overflowing: false });
  });
  it("caps at six lines and keeps the rest scrollable", () => {
    expect(coachComposerHeight(800, 24, 20, 2)).toEqual({ height: 166, overflowing: true });
  });
  it("uses the actual enlarged text metrics", () => {
    expect(coachComposerHeight(600, 48, 20, 0)).toEqual({ height: 308, overflowing: true });
    expect(coachComposerHeight(0, 48, 20, 0)).toEqual({ height: 116, overflowing: false });
  });
  it.each([NaN, Infinity, -Infinity, -10])("handles invalid layout values %s", (value) => {
    const size = coachComposerHeight(value, value, value, value);
    expect(Number.isFinite(size.height)).toBe(true);
    expect(size.height).toBeGreaterThanOrEqual(44);
  });
});
