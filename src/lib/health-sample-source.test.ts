import { describe, expect, it } from "vitest";
import {
  DEFAULT_HEALTH_SAMPLE_SOURCE,
  HEALTH_SAMPLE_SOURCES,
  sourceClaim,
} from "./health-sample-source";

/**
 * The ingest endpoint recorded a sender that said nothing about itself as an
 * Apple Health sync. The rail then called it a device reading, which happened
 * to be true and was never established.
 */

describe("what a stored source entitles the product to say", () => {
  it("calls a phone or watch platform a device", () => {
    expect(sourceClaim("apple_health")).toBe("device");
    expect(sourceClaim("google_fit")).toBe("device");
  });

  it("keeps a typed-in reading and a photo blend apart from both", () => {
    expect(sourceClaim("manual")).toBe("manual");
    // Not a measurement anybody took: the scan includes a vision model's
    // visual estimate.
    expect(sourceClaim("photo_estimate")).toBe("estimate");
  });

  it("does not call an imported file a device reading", () => {
    // It read as "device" before, because the rail collapsed everything that
    // was not manual. A file the athlete uploaded is not what their watch saw.
    expect(sourceClaim("import")).toBe("imported");
    expect(sourceClaim("import")).not.toBe("device");
  });

  it("says unknown when nothing said, rather than guessing a device", () => {
    expect(sourceClaim("unknown")).toBe("unknown");
    expect(sourceClaim(null)).toBe("unknown");
    expect(sourceClaim(undefined)).toBe("unknown");
    expect(sourceClaim("")).toBe("unknown");
  });

  it("never promotes a source this build does not recognise to a device", () => {
    // The one case where guessing is most likely to be wrong: a value written
    // by a newer build, or by something nobody has seen.
    for (const strange of ["garmin", "oura", "whoop", "WATCH", "apple health"]) {
      expect(sourceClaim(strange)).toBe("unknown");
    }
  });

  it("records a silent sender as unknown rather than as a named vendor", () => {
    // The defect. `apple_health` is a claim about a specific company's
    // platform, and it was the default for a request that named nothing.
    expect(DEFAULT_HEALTH_SAMPLE_SOURCE).toBe("unknown");
    expect(HEALTH_SAMPLE_SOURCES).toContain("unknown");
    expect(sourceClaim(DEFAULT_HEALTH_SAMPLE_SOURCE)).toBe("unknown");
  });

  it("has a claim for every source it accepts", () => {
    for (const source of HEALTH_SAMPLE_SOURCES) {
      expect(sourceClaim(source)).not.toBeUndefined();
    }
  });
});
