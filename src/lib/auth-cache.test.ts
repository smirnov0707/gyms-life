import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { identityChanged } from "./auth-cache";

describe("identityChanged", () => {
  const A = "11111111-1111-4111-8111-111111111111";
  const B = "22222222-2222-4222-8222-222222222222";

  it("does not fire on the first resolution after a page load", () => {
    expect(identityChanged(undefined, A)).toBe(false);
    expect(identityChanged(undefined, null)).toBe(false);
  });

  it("does not fire on a token refresh, which keeps the same person", () => {
    expect(identityChanged(A, A)).toBe(false);
    expect(identityChanged(null, null)).toBe(false);
  });

  it("fires on sign-out, so nothing cached survives into the signed-out app", () => {
    expect(identityChanged(A, null)).toBe(true);
  });

  it("fires when a second account signs in — the case that leaks", () => {
    expect(identityChanged(A, B)).toBe(true);
    expect(identityChanged(null, A)).toBe(true);
  });
});

describe("where the cache is dropped", () => {
  /**
   * The drop lives in `AuthProvider`, which can only reach the cache from
   * inside the provider that owns it. Move the two apart and the app stops
   * booting — but only for a signed-in visitor, which is exactly the person a
   * test suite tends not to be.
   */
  it("keeps AuthProvider inside the QueryClientProvider that owns the cache", () => {
    const root = readFileSync(path.resolve("src/routes/__root.tsx"), "utf8");
    const provider = root.indexOf("<QueryClientProvider");
    const auth = root.indexOf("<AuthProvider>");
    expect(provider).toBeGreaterThan(-1);
    expect(auth).toBeGreaterThan(provider);
    expect(root.indexOf("</AuthProvider>")).toBeLessThan(root.indexOf("</QueryClientProvider>"));
  });

  it("drops every cached answer, rather than trusting each key to name its owner", () => {
    const auth = readFileSync(path.resolve("src/lib/auth.tsx"), "utf8");
    expect(auth).toContain("queryClient.clear()");
    expect(auth).toContain("identityChanged");
  });
});
