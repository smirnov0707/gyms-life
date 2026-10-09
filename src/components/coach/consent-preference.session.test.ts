import { SupportedLanguageSchema } from "@/lib/language.schema";
import { describe, expect, it, vi } from "vitest";
import { createConsentPreferenceSession } from "./consent-preference.session";
import { consentPreferenceCopy, consentPreferenceStatus } from "./consent-preference.copy";

function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<unknown>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function setup(authenticated = true) {
  const services = {
    read: vi.fn<() => Promise<unknown>>(async () => ({ enabled: false })),
    write: vi.fn<(granted: boolean) => Promise<unknown>>(async (enabled) => ({ enabled })),
    report: vi.fn(),
  };
  return { services, session: createConsentPreferenceSession(services, authenticated) };
}

describe("Coach privacy preference read/write session", () => {
  it("starts unknown and performs no read before activation", async () => {
    const { session, services } = setup();
    expect(session.getSnapshot()).toEqual({ status: "loading" });
    await session.load();
    await session.toggle();
    expect(services.read).not.toHaveBeenCalled();
    expect(services.write).not.toHaveBeenCalled();
  });

  it.each([false, true])("shows %s only after a confirmed read", async (enabled) => {
    const { session, services } = setup();
    services.read.mockResolvedValue({ enabled });
    await session.start();
    expect(session.getSnapshot()).toEqual({ status: "ready", enabled });
    expect(services.write).not.toHaveBeenCalled();
  });

  it("does not convert a failed read into disabled consent or permit a write", async () => {
    const { session, services } = setup();
    services.read.mockRejectedValue(new Error("Synthetic failure"));
    await session.start();
    await session.toggle();
    expect(session.getSnapshot()).toEqual({ status: "unavailable", reason: "read" });
    expect(services.report).toHaveBeenCalledWith("read");
    expect(services.write).not.toHaveBeenCalled();
  });

  it.each([null, undefined, {}, [], { enabled: "false" }, { enabled: 0 }])(
    "rejects malformed read confirmations: %j",
    async (value) => {
      const { session, services } = setup();
      services.read.mockResolvedValue(value);
      await session.start();
      expect(session.getSnapshot()).toEqual({ status: "unavailable", reason: "read" });
      expect(services.write).not.toHaveBeenCalled();
    },
  );

  it("recovers a failed read without writing a new consent decision", async () => {
    const { session, services } = setup();
    services.read.mockRejectedValueOnce(new Error("Synthetic failure"));
    await session.start();
    services.read.mockResolvedValue({ enabled: true });
    await session.load();
    expect(session.getSnapshot()).toEqual({ status: "ready", enabled: true });
    expect(services.write).not.toHaveBeenCalled();
  });

  it("deduplicates same-tick reads and blocks a toggle while reading", async () => {
    const { session, services } = setup();
    const read = deferred();
    services.read.mockReturnValue(read.promise);
    const started = session.start();
    await Promise.all([session.start(), session.load(), session.load(), session.toggle()]);
    expect(services.read).toHaveBeenCalledTimes(1);
    expect(services.write).not.toHaveBeenCalled();
    read.resolve({ enabled: true });
    await started;
    expect(session.getSnapshot()).toEqual({ status: "ready", enabled: true });
  });

  it.each([false, true])("waits for confirmation when changing %s", async (enabled) => {
    const { session, services } = setup();
    services.read.mockResolvedValue({ enabled });
    await session.start();
    const write = deferred();
    services.write.mockReturnValue(write.promise);
    const saving = session.toggle();
    await Promise.all([session.toggle(), session.toggle(), session.load()]);
    expect(services.write).toHaveBeenCalledTimes(1);
    expect(services.write).toHaveBeenCalledWith(!enabled);
    expect(session.getSnapshot()).toEqual({ status: "saving", enabled, requested: !enabled });
    write.resolve({ enabled: !enabled });
    await saving;
    expect(session.getSnapshot()).toEqual({ status: "ready", enabled: !enabled });
  });

  it("treats a lost write reply as unconfirmed and only permits a read next", async () => {
    const { session, services } = setup();
    await session.start();
    services.write.mockRejectedValue(new Error("Reply lost after server commit"));
    await session.toggle();
    expect(session.getSnapshot()).toEqual({ status: "unavailable", reason: "save" });
    await session.toggle();
    await session.toggle();
    expect(services.write).toHaveBeenCalledTimes(1);
    expect(services.read).toHaveBeenCalledTimes(1);
    services.read.mockResolvedValue({ enabled: true });
    await session.load();
    expect(session.getSnapshot()).toEqual({ status: "ready", enabled: true });
    expect(services.write).toHaveBeenCalledTimes(1);
  });

  it.each([null, {}, { enabled: "true" }, { enabled: false }])(
    "does not mark an invalid or mismatched save reply successful: %j",
    async (value) => {
      const { session, services } = setup();
      await session.start();
      services.write.mockResolvedValue(value);
      await session.toggle();
      expect(session.getSnapshot()).toEqual({ status: "unavailable", reason: "save" });
      expect(services.report).toHaveBeenCalledWith("save");
    },
  );

  it("ignores a read reply from a stopped lifecycle after StrictMode restarts it", async () => {
    const { session, services } = setup();
    const old = deferred(),
      fresh = deferred();
    services.read.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const first = session.start();
    session.stop();
    const second = session.start();
    fresh.resolve({ enabled: false });
    await second;
    old.resolve({ enabled: true });
    await first;
    expect(session.getSnapshot()).toEqual({ status: "ready", enabled: false });
    expect(services.report).not.toHaveBeenCalled();
  });

  it("does not unlock or replace a fresh read when an earlier save completes", async () => {
    const { session, services } = setup();
    await session.start();
    const oldSave = deferred(),
      freshRead = deferred();
    services.write.mockReturnValue(oldSave.promise);
    const saving = session.toggle();
    session.stop();
    services.read.mockReturnValue(freshRead.promise);
    const reading = session.start();
    oldSave.resolve({ enabled: true });
    await saving;
    await session.toggle();
    await session.load();
    expect(session.getSnapshot()).toEqual({ status: "loading" });
    expect(services.write).toHaveBeenCalledTimes(1);
    expect(services.read).toHaveBeenCalledTimes(2);
    freshRead.resolve({ enabled: false });
    await reading;
    expect(session.getSnapshot()).toEqual({ status: "ready", enabled: false });
  });

  it("does not notify or log stale failures after unmount", async () => {
    const { session, services } = setup();
    const read = deferred();
    services.read.mockReturnValue(read.promise);
    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);
    const started = session.start();
    session.stop();
    unsubscribe();
    listener.mockClear();
    read.reject(new Error("Late reply"));
    await started;
    expect(listener).not.toHaveBeenCalled();
    expect(services.report).not.toHaveBeenCalled();
  });

  it("separates account instances and never fetches or writes when signed out", async () => {
    const old = setup(),
      fresh = setup(),
      signedOut = setup(false);
    old.services.read.mockResolvedValue({ enabled: true });
    await old.session.start();
    old.session.stop();
    expect(fresh.session.getSnapshot()).toEqual({ status: "loading" });
    await fresh.session.start();
    expect(fresh.session.getSnapshot()).toEqual({ status: "ready", enabled: false });
    await signedOut.session.start();
    await signedOut.session.load();
    await signedOut.session.toggle();
    expect(signedOut.session.getSnapshot()).toEqual({ status: "signed_out" });
    expect(signedOut.services.read).not.toHaveBeenCalled();
    expect(signedOut.services.write).not.toHaveBeenCalled();
  });

  it("keeps stable snapshots between notifications and a stable SSR snapshot", async () => {
    const { session } = setup();
    const initial = session.getServerSnapshot();
    expect(session.getSnapshot()).toBe(session.getSnapshot());
    await session.start();
    expect(session.getServerSnapshot()).toBe(initial);
    expect(initial).toEqual({ status: "loading" });
  });
});

describe("truthful, localized privacy status", () => {
  it.each(SupportedLanguageSchema.options)(
    "%s never describes an unread preference as enabled or disabled",
    (lang) => {
      const copy = consentPreferenceCopy(lang);
      for (const reason of ["read", "save"] as const) {
        const text = consentPreferenceStatus({ status: "unavailable", reason }, lang);
        expect(text).toBe(copy.status[reason]);
        expect(text).not.toBe(copy.active);
        expect(text).not.toBe(copy.inactive);
      }
      expect(copy.status.read).not.toBe(copy.status.save);
      if (lang !== "lt") expect(copy.status).toEqual(consentPreferenceCopy("en").status);
    },
  );
});
