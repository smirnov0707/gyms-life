import { describe, expect, it } from "vitest";
import {
  MAX_SCAN_WARNINGS,
  MEDICAL_DISCLAIMER,
  withMedicalDisclaimer,
} from "./micronutrient.warnings";

/**
 * The scanner names deficiencies and recommends a supplement with a dose. The
 * sentence saying that is not a diagnosis used to be guaranteed only when the
 * AI failed; on the path an athlete actually sees, the model decided.
 */

describe("the warnings a micronutrient scan carries", () => {
  it("always leads with the disclaimer, whatever the model returned", () => {
    expect(withMedicalDisclaimer([], "en")[0]).toBe(MEDICAL_DISCLAIMER.en);
    expect(withMedicalDisclaimer(["Log meals daily."], "en")[0]).toBe(MEDICAL_DISCLAIMER.en);
  });

  it("says it in the athlete's language", () => {
    expect(withMedicalDisclaimer([], "lt")[0]).toBe(MEDICAL_DISCLAIMER.lt);
    expect(withMedicalDisclaimer([], "lt-LT")[0]).toBe(MEDICAL_DISCLAIMER.lt);
    // Every other language falls back to English rather than to nothing.
    expect(withMedicalDisclaimer([], "de")[0]).toBe(MEDICAL_DISCLAIMER.en);
  });

  it("survives a model that returned nothing at all", () => {
    // The failure this exists for: the component renders the warnings block
    // only when the list is non-empty, so an empty list removed the sentence
    // from a screen that was still prescribing vitamin D.
    expect(withMedicalDisclaimer([], "en")).toEqual([MEDICAL_DISCLAIMER.en]);
  });

  it("keeps the model's own warnings after it", () => {
    expect(withMedicalDisclaimer(["Iron is low.", "Log meals daily."], "en")).toEqual([
      MEDICAL_DISCLAIMER.en,
      "Iron is low.",
      "Log meals daily.",
    ]);
  });

  it("does not repeat a disclaimer the model already produced", () => {
    expect(
      withMedicalDisclaimer(
        ["  this is NOT a  medical diagnosis. see a doctor for blood work. "],
        "en",
      ),
    ).toEqual([MEDICAL_DISCLAIMER.en]);
  });

  it("drops empty and duplicate warnings rather than showing blank rows", () => {
    expect(withMedicalDisclaimer(["", "   ", "Iron is low.", "Iron is low."], "en")).toEqual([
      MEDICAL_DISCLAIMER.en,
      "Iron is low.",
    ]);
  });

  it("trims the model's warnings when capped, never the disclaimer", () => {
    const many = Array.from({ length: 20 }, (_, index) => `Warning ${index}`);
    const result = withMedicalDisclaimer(many, "en");
    expect(result).toHaveLength(MAX_SCAN_WARNINGS);
    expect(result[0]).toBe(MEDICAL_DISCLAIMER.en);
  });

  it("keeps the disclaimer even at a cap of one", () => {
    expect(withMedicalDisclaimer(["Iron is low."], "en", 1)).toEqual([MEDICAL_DISCLAIMER.en]);
    expect(withMedicalDisclaimer(["Iron is low."], "en", 0)).toEqual([MEDICAL_DISCLAIMER.en]);
  });
});
