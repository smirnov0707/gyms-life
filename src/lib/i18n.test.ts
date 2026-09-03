import { describe, expect, it } from "vitest";
import { preloadSupplementalLocale, tr } from "./i18n";

describe("supplemental locale loading", () => {
  it("keeps base translations synchronous and upgrades only the selected optional language", async () => {
    expect(tr("lt", "nav.dashboard")).toBe("Apžvalga");
    expect(tr("en", "nav.dashboard")).toBe("Dashboard");

    // The English value is a safe, non-blocking fallback before the optional pack arrives.
    expect(tr("ru", "nav.dashboard")).toBe("Dashboard");

    await preloadSupplementalLocale("ru");

    expect(tr("ru", "nav.dashboard")).toBe("Панель");
    expect(tr("fr", "nav.dashboard")).toBe("Dashboard");
  });

  it("retains every supplemental language pack behind its own loader", async () => {
    await Promise.all([
      preloadSupplementalLocale("uk"),
      preloadSupplementalLocale("pl"),
      preloadSupplementalLocale("de"),
      preloadSupplementalLocale("es"),
      preloadSupplementalLocale("fr"),
    ]);

    expect(tr("uk", "nav.dashboard")).toBe("Дашборд");
    expect(tr("pl", "nav.dashboard")).toBe("Panel");
    expect(tr("de", "nav.dashboard")).toBe("Dashboard");
    expect(tr("es", "nav.dashboard")).toBe("Panel");
    expect(tr("fr", "nav.dashboard")).toBe("Tableau de bord");
  });
});
