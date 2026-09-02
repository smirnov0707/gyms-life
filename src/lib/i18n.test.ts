import { describe, expect, it } from "vitest";
import { preloadSupplementalLocales, tr } from "./i18n";

describe("supplemental locale loading", () => {
  it("keeps base translations synchronous and upgrades an optional language after it loads", async () => {
    expect(tr("lt", "nav.dashboard")).toBe("Apžvalga");
    expect(tr("en", "nav.dashboard")).toBe("Dashboard");

    // The English value is a safe, non-blocking fallback before the optional pack arrives.
    expect(tr("ru", "nav.dashboard")).toBe("Dashboard");

    await preloadSupplementalLocales();

    expect(tr("ru", "nav.dashboard")).toBe("Панель");
  });
});
