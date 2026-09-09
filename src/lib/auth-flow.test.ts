import { describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";
import { safeAuthNext } from "./auth-redirect";
import { submitAuthForm } from "./auth-form.service";
import { createAuthSessionController } from "./auth-session.controller";

const session = {
  access_token: "synthetic",
  user: { id: "11111111-1111-4111-8111-111111111111" },
} as Session;
const input = {
  mode: "up" as const,
  email: "  synthetic@example.invalid  ",
  password: "synthetic-test-password",
  name: "Synthetic",
  origin: "https://gyms.example",
  next: "/training",
};
function auth() {
  return { signInWithPassword: vi.fn(), signUp: vi.fn(), resetPasswordForEmail: vi.fn() };
}
describe("same-origin authentication continuation", () => {
  it.each([
    "//evil.test",
    "/\\evil.test",
    "/%5cevil.test",
    "/%2fexample.test",
    "/\nevil",
    "/%0d%0aHost:x",
    "javascript:alert(1)",
    "https://evil.test",
    " /app",
    "/%zz",
    "/auth?next=/auth",
    "/reset-password",
    null,
    {},
  ])("rejects unsafe/cyclic redirect %j", (value) => expect(safeAuthNext(value)).toBeUndefined());
  it.each([
    ["/training", "/training"],
    ["/x/../app?tab=twin#body", "/app?tab=twin#body"],
    ["/meal-plan?lang=lt", "/meal-plan?lang=lt"],
  ])("retains local paths %s", (value, expected) => expect(safeAuthNext(value)).toBe(expected));
});
describe("auth form provider response contract", () => {
  it("does not call confirmation-only registration a session", async () => {
    const api = auth();
    api.signUp.mockResolvedValue({
      data: { user: { id: "synthetic" }, session: null },
      error: null,
    });
    await expect(submitAuthForm(api, input)).resolves.toBe("confirm-email");
    expect(api.signUp.mock.calls[0]![0]).toMatchObject({
      email: "synthetic@example.invalid",
      options: { emailRedirectTo: "https://gyms.example/training" },
    });
  });
  it("uses a safe fallback for the email confirmation redirect", async () => {
    const api = auth();
    api.signUp.mockResolvedValue({ data: { session: null }, error: null });
    await submitAuthForm(api, { ...input, next: "/\\evil.test" });
    expect(api.signUp.mock.calls[0]![0].options.emailRedirectTo).toBe("https://gyms.example/app");
  });
  it("only signals signed in when a session was returned", async () => {
    const api = auth();
    api.signInWithPassword
      .mockResolvedValueOnce({ data: { session: null }, error: null })
      .mockResolvedValueOnce({ data: { session }, error: null });
    await expect(submitAuthForm(api, { ...input, mode: "in" })).rejects.toThrow(
      "AUTH_SESSION_UNAVAILABLE",
    );
    await expect(submitAuthForm(api, { ...input, mode: "in" })).resolves.toBe("authenticated");
  });
  it("propagates failures without a confirmation success", async () => {
    const api = auth();
    api.signUp.mockResolvedValue({
      data: { session: null },
      error: new Error("synthetic refusal"),
    });
    await expect(submitAuthForm(api, input)).rejects.toThrow();
  });
  it("requests recovery at the current origin and does not log in", async () => {
    const api = auth();
    api.resetPasswordForEmail.mockResolvedValue({ error: null });
    await expect(submitAuthForm(api, { ...input, mode: "forgot", password: "" })).resolves.toBe(
      "reset-requested",
    );
    expect(api.resetPasswordForEmail).toHaveBeenCalledWith("synthetic@example.invalid", {
      redirectTo: "https://gyms.example/reset-password",
    });
    expect(api.signInWithPassword).not.toHaveBeenCalled();
  });
  it("rejects invalid form values before contacting auth", async () => {
    const api = auth();
    await expect(submitAuthForm(api, { ...input, email: "not-email" })).rejects.toThrow();
    expect(api.signUp).not.toHaveBeenCalled();
  });
});
describe("session lifecycle ordering", () => {
  const pending = () => {
    let resolve!: (x: { data: { session: Session | null }; error: unknown }) => void;
    const promise = new Promise<{ data: { session: Session | null }; error: unknown }>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  };
  it("late focus/session read cannot undo a newer sign-out", async () => {
    const task = pending(),
      apply = vi.fn(),
      failed = vi.fn();
    const c = createAuthSessionController({ read: () => task.promise, apply, failed });
    const read = c.refresh();
    c.event(null);
    task.resolve({ data: { session }, error: null });
    await read;
    expect(apply.mock.calls).toEqual([[null]]);
    expect(failed).not.toHaveBeenCalled();
  });
  it("the latest concurrent read wins", async () => {
    const a = pending(),
      b = pending(),
      apply = vi.fn(),
      read = vi.fn().mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const c = createAuthSessionController({ read, apply, failed: vi.fn() });
    const first = c.refresh(),
      second = c.refresh();
    b.resolve({ data: { session: null }, error: null });
    await second;
    a.resolve({ data: { session }, error: null });
    await first;
    expect(apply.mock.calls).toEqual([[null]]);
  });
  it("network rejection is handled, not fabricated as a sign-out", async () => {
    const apply = vi.fn(),
      failed = vi.fn();
    const c = createAuthSessionController({
      read: async () => {
        throw new Error("offline");
      },
      apply,
      failed,
    });
    c.event(session);
    await expect(c.refresh()).resolves.toBe(false);
    expect(apply.mock.calls).toEqual([[session]]);
    expect(failed).toHaveBeenCalledTimes(1);
  });
  it("unmounted/old attempt cannot publish state", async () => {
    const task = pending(),
      apply = vi.fn();
    const c = createAuthSessionController({ read: () => task.promise, apply, failed: vi.fn() });
    const read = c.refresh();
    c.dispose();
    c.event(session);
    task.resolve({ data: { session }, error: null });
    await read;
    expect(apply).not.toHaveBeenCalled();
  });
});
