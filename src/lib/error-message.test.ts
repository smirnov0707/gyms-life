import { describe, expect, it } from "vitest";
import { AthleteFacingError, errorMessage } from "./error-message";

describe("errorMessage", () => {
  it("does not expose server implementation details", () => {
    expect(
      errorMessage(
        new Error('relation "profiles" does not exist at character 15'),
        "Nepavyko įvykdyti veiksmo. Bandykite dar kartą.",
      ),
    ).toBe("Nepavyko įvykdyti veiksmo. Bandykite dar kartą.");
  });

  it("does not trust a string error as user-facing copy", () => {
    expect(
      errorMessage("Cannot read properties of null (reading 'specificationVersion')", "Try again."),
    ).toBe("Try again.");
  });

  it("says the sentence that was written for the athlete", () => {
    // The defect this class exists for. The workout screen composed and
    // translated "Reconnect so your sets are saved before finishing the
    // workout", threw it, and then replaced it here with "Could not finish the
    // workout" — which names no cause, offers no action, and reads as though
    // the session were lost.
    expect(
      errorMessage(
        new AthleteFacingError("Atkurkite ryšį, kad serijos būtų išsaugotos."),
        "Nepavyko užbaigti treniruotės",
      ),
    ).toBe("Atkurkite ryšį, kad serijos būtų išsaugotos.");
  });

  it("still falls back when the authored message is empty", () => {
    // A blank toast is worse than a generic one.
    expect(errorMessage(new AthleteFacingError("   "), "Try again.")).toBe("Try again.");
  });

  it("does not let a subclass of Error through on the strength of being an Error", () => {
    // The guard is the class, not the shape: a DOMException or a framework
    // error must never reach a toast, however tidy its message looks.
    class LooksFriendly extends Error {}
    expect(errorMessage(new LooksFriendly("Quota exceeded."), "Try again.")).toBe("Try again.");
  });
});
