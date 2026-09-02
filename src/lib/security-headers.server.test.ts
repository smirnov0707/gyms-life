import { describe, expect, it } from "vitest";
import { applySecurityHeaders } from "./security-headers.server";

describe("applySecurityHeaders", () => {
  it("preserves the response while protecting SSR and API output", async () => {
    const secured = applySecurityHeaders(
      new Response("ok", {
        status: 201,
        headers: { "content-type": "text/plain" },
      }),
    );

    expect(secured.status).toBe(201);
    expect(secured.headers.get("content-type")).toBe("text/plain");
    expect(secured.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(secured.headers.get("x-frame-options")).toBe("DENY");
    expect(secured.headers.get("permissions-policy")).toContain("camera=(self)");
    await expect(secured.text()).resolves.toBe("ok");
  });
});
