import { describe, expect, it } from "vitest";
import { errorMessage } from "./error-message";

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
});
