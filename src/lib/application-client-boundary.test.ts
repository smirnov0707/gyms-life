import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const io = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: io.create }));
const REF = "yywnpovsqifwujuxdxog",
  SITE = "singular-vacherin-57448d",
  KEY = "sb_publishable_synthetic0123456789012345",
  ID = "a".repeat(24);
const metadata = {
  provider: "netlify",
  context: "deploy-preview",
  target: "staging",
  projectRef: REF,
  siteId: "0d17652b-c26c-4ada-9792-d332c7572536",
  siteName: SITE,
  sourceCommit: "a".repeat(40),
};
let touched: number, write: ReturnType<typeof vi.fn>, remove: ReturnType<typeof vi.fn>;
function browser(href: string) {
  const win = { location: { href } };
  Object.defineProperty(win, "localStorage", {
    get: () => {
      touched++;
      return { getItem: () => "preserved old workout bytes", setItem: write, removeItem: remove };
    },
  });
  vi.stubGlobal("window", win);
  return win;
}
beforeEach(() => {
  vi.resetModules();
  io.create.mockReset().mockReturnValue({ auth: { sentinel: true } });
  touched = 0;
  write = vi.fn();
  remove = vi.fn();
  vi.stubEnv("VITE_GYMSLIFE_BUILD", JSON.stringify(metadata));
  vi.stubEnv("VITE_SUPABASE_URL", `https://${REF}.supabase.co`);
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", KEY);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("actual lazy Supabase adapter cannot initialize on the wrong domain", () => {
  it("refuses published-preview client code before accessing old session/local queue storage", async () => {
    browser("https://gyms.life/auth");
    const network = vi.fn();
    vi.stubGlobal("fetch", network);
    const { supabase } = await import("../integrations/supabase/client");
    expect(() => supabase.auth).toThrow("APPLICATION_ENVIRONMENT_UNSAFE");
    expect(touched).toBe(0);
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(io.create).not.toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
  });
  it("permits a valid immutable preview and preserves SDK creation options", async () => {
    browser(`https://${ID}--${SITE}.netlify.app/auth`);
    const { supabase } = await import("../integrations/supabase/client");
    expect(supabase.auth).toMatchObject({ sentinel: true });
    expect(io.create).toHaveBeenCalledOnce();
    expect(io.create.mock.calls[0]![0]).toBe(`https://${REF}.supabase.co`);
    expect(io.create.mock.calls[0]![2].auth.persistSession).toBe(true);
    expect(remove).not.toHaveBeenCalled();
  });
  it("also checks every outgoing SDK request, not just its initial creation", async () => {
    const win = browser(`https://${ID}--${SITE}.netlify.app/auth`),
      network = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", network);
    const { supabase } = await import("../integrations/supabase/client");
    void supabase.auth;
    const send = io.create.mock.calls[0]![2].global.fetch;
    await send(`https://${REF}.supabase.co/auth/v1/user`, {
      headers: { Authorization: `Bearer ${KEY}` },
    });
    expect(network).toHaveBeenCalledOnce();
    expect(new Headers(network.mock.calls[0]![1].headers).get("Authorization")).toBeNull();
    win.location.href = "https://gyms.life/app";
    expect(() => send(`https://${REF}.supabase.co/auth/v1/user`)).toThrow(
      "APPLICATION_ENVIRONMENT_UNSAFE",
    );
    expect(network).toHaveBeenCalledOnce();
  });
  it.each(["sb_secret_synthetic0123456789012345", "bad-not-a-publishable-key"])(
    "does not expose an unsafe client API key %s",
    async (key) => {
      browser(`https://${ID}--${SITE}.netlify.app`);
      vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", key);
      const { supabase } = await import("../integrations/supabase/client");
      expect(() => supabase.auth).toThrow("APPLICATION_CLIENT_KEY_UNSAFE");
      expect(io.create).not.toHaveBeenCalled();
      expect(touched).toBe(0);
    },
  );
  it("malformed pinned metadata cannot silently fall back to a server project", async () => {
    browser(`https://${ID}--${SITE}.netlify.app`);
    vi.stubEnv("VITE_GYMSLIFE_BUILD", "bad");
    const { supabase } = await import("../integrations/supabase/client");
    expect(() => supabase.auth).toThrow("APPLICATION_ENVIRONMENT_UNSAFE");
    expect(io.create).not.toHaveBeenCalled();
  });
});
