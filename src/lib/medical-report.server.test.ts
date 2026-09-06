import { describe, expect, it } from "vitest";
import { nutritionProvenanceNote } from "./medical-report.server";

describe("nutritionProvenanceNote", () => {
  it("says nothing was logged when nothing was", () => {
    expect(nutritionProvenanceNote({ photo: 0, text: 0, unrecorded: 0 })).toBe("no meals logged");
  });

  it("counts each capture method it actually saw", () => {
    const note = nutritionProvenanceNote({ photo: 12, text: 5, unrecorded: 0 });
    expect(note).toContain("17 entries");
    expect(note).toContain("12 from photographs");
    expect(note).toContain("5 from typed descriptions");
    expect(note).not.toContain("not recorded");
  });

  it("omits a method with no entries instead of writing a zero", () => {
    expect(nutritionProvenanceNote({ photo: 0, text: 3, unrecorded: 0 })).not.toContain(
      "photographs",
    );
  });

  it("names rows whose capture method was never recorded", () => {
    expect(nutritionProvenanceNote({ photo: 0, text: 0, unrecorded: 4 })).toContain(
      "4 with the capture method not recorded",
    );
  });

  it("never presents an estimate as weighed", () => {
    expect(nutritionProvenanceNote({ photo: 1, text: 1, unrecorded: 1 })).toContain("none weighed");
  });
});
