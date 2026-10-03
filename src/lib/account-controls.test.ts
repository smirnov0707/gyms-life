import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DELETE_ACCOUNT_CONFIRMATION } from "./delete-account.functions";

/**
 * Two things an app that holds a person's body measurements has to offer, and
 * neither existed.
 *
 * Nothing called `supabase.auth.signOut` and the auth context did not expose
 * it, so the only way out of a session was clearing site data. And the privacy
 * policy's section 6 promised the right to erasure, in eight languages, with a
 * one-month response — against code with no mechanism at all.
 */

const CONTROLS = path.resolve("src/components/AccountControls.tsx");
const AUTH = path.resolve("src/lib/auth.tsx");
const PROFILE = path.resolve("src/routes/_authenticated/me.tsx");
const LEGAL = path.resolve("src/lib/i18n-extra-legal.ts");

const controls = () => readFileSync(CONTROLS, "utf8");

describe("ending a session", () => {
  it("is something the auth context actually offers", () => {
    const auth = readFileSync(AUTH, "utf8");
    expect(auth).toMatch(/signOut: \(\) => Promise<boolean>/);
    expect(auth).toMatch(/supabase\.auth\.signOut\(\{ scope: "local" \}\)/);
  });

  it("clears the local session even when the provider call fails", () => {
    // Somebody on a borrowed phone asked to be signed out. A refused network
    // call must not leave them signed in.
    const auth = readFileSync(AUTH, "utf8");
    const body =
      /const signOut = useCallback\(async \(\) => \{([\s\S]*?)\n {2}\}, \[queryClient\]\);/.exec(
        auth,
      )?.[1];
    expect(body).toBeTruthy();
    expect(body).toMatch(/catch \{/);
    expect(body).toMatch(/setSession\(null\)/);
    expect(body).toMatch(/offlineIdentity\.set\(null\)/);
    // The cache is keyed per owner; the next person to sign in on this device
    // must not see the previous athlete's answers.
    expect(body).toMatch(/queryClient\.clear\(\)/);
  });

  it("is reachable from a screen, not only from the context", () => {
    expect(readFileSync(PROFILE, "utf8")).toMatch(/<AccountControls \/>/);
    expect(controls()).toMatch(/onClick=\{\(\) => void leave\(\)\}/);
  });
});

describe("erasing the account", () => {
  it("cannot happen on a single tap", () => {
    // A phone in a gym bag should not be able to do this.
    expect(DELETE_ACCOUNT_CONFIRMATION).toBe("DELETE");
    expect(controls()).toMatch(/disabled=\{!confirmed \|\| busy !== "none"\}/);
    expect(controls()).toMatch(/typed\.trim\(\) === DELETE_ACCOUNT_CONFIRMATION/);
  });

  it("says what is deleted and what is kept, in both copy branches", () => {
    const source = controls();
    for (const marker of ["dangerBody", "kept"]) {
      expect(source).toMatch(new RegExp(`${marker}:`));
    }
    // Paddle keeps payment records and operational events survive anonymised.
    // Promising a cleaner sweep than the database performs would be the same
    // defect this week has been about.
    expect(source).toMatch(/Paddle/);
    expect(source).toMatch(/nebenurodo tavęs/);
    expect(source).toMatch(/no longer name you/);
  });

  it("does not claim the session survives a deleted user", () => {
    // The row is gone, so the session names nobody. Clearing it is what makes
    // the next screen the public one instead of a shell querying for rows that
    // no longer exist.
    const destroy = /const destroy = async \(\) => \{([\s\S]*?)\n {2}\};/.exec(controls())?.[1];
    expect(destroy).toBeTruthy();
    const deleted = destroy?.indexOf('result.status !== "deleted"') ?? -1;
    const cleared = destroy?.indexOf("await signOut()") ?? -1;
    expect(deleted).toBeGreaterThan(-1);
    expect(cleared).toBeGreaterThan(deleted);
  });

  it("is the mechanism the privacy policy has been promising", () => {
    // The pair. The policy made the commitment; until now nothing kept it.
    expect(readFileSync(LEGAL, "utf8")).toMatch(/right to access, rectify, erase/);
    expect(controls()).toMatch(/deleteMyAccount/);
  });
});
