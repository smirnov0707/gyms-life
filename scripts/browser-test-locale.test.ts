import { describe, expect, it, vi } from "vitest";
import { runInNewContext } from "node:vm";
import { initializePageLocale } from "./browser-test-locale.mjs";
const code = `(${initializePageLocale.toString()})({origin:"https://test.invalid",language:"lt"})`;
describe("test instrumentation does not touch host-owned frames", () => {
  it("sets the requested locale only on its own top-level document", () => {
    const top: { top?: unknown } = {};
    top.top = top;
    const setItem = vi.fn();
    runInNewContext(code, {
      window: top,
      location: { origin: "https://test.invalid" },
      localStorage: { setItem },
    });
    expect(setItem).toHaveBeenCalledExactlyOnceWith("forma_lang", "lt");
  });
  it.each(["https://test.invalid", "null", "https://other.invalid"])(
    "does not access child-frame storage at origin %s",
    (origin) => {
      const frame = { top: {} },
        sandbox = { window: frame, location: { origin } },
        access = vi.fn(() => {
          throw new Error("denied storage");
        });
      Object.defineProperty(sandbox, "localStorage", { get: access });
      runInNewContext(code, sandbox);
      expect(access).not.toHaveBeenCalled();
    },
  );
  it.each(["null", "https://other.invalid"])(
    "skips foreign or about:blank top documents %s",
    (origin) => {
      const top: { top?: unknown } = {};
      top.top = top;
      const access = vi.fn(() => {
          throw new Error("denied");
        }),
        sandbox = { window: top, location: { origin } };
      Object.defineProperty(sandbox, "localStorage", { get: access });
      runInNewContext(code, sandbox);
      expect(access).not.toHaveBeenCalled();
    },
  );
  it("never suppresses a real storage failure inside the intended app document", () => {
    const top: { top?: unknown } = {};
    top.top = top;
    const sandbox = { window: top, location: { origin: "https://test.invalid" } };
    Object.assign(sandbox, {
      localStorage: {
        setItem() {
          throw new Error("actual app storage denied");
        },
      },
    });
    expect(() => runInNewContext(code, sandbox)).toThrow("actual app storage denied");
  });
});
