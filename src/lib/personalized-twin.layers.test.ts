import { describe, expect, it } from "vitest";
import { buildPersonalizedTwinLayers } from "./personalized-twin.layers";

describe("Personalized Twin layer separation", () => {
  it("keeps a personalized identity shell visual-only", () => {
    const bundle = buildPersonalizedTwinLayers({
      identity: {
        status: "personalized",
        source: "external_reconstruction",
        providerKey: "in3d",
        modelObjectPath: "user/capture/model.glb",
        visualIdentityOnly: true,
        bodyGeometryAuthority: false,
        medicalScan: false,
      },
      geometry: {
        status: "unknown",
        source: "none",
        providerKey: null,
        measuredAt: null,
        mayDriveBodyMetrics: false,
        medicalScan: false,
      },
    });
    expect(bundle.identity.bodyGeometryAuthority).toBe(false);
    expect(bundle.geometry.status).toBe("unknown");
  });

  it("rejects unknown geometry as a body-metric authority", () => {
    expect(() =>
      buildPersonalizedTwinLayers({
        identity: {
          status: "generic",
          source: "gyms_generic",
          providerKey: null,
          modelObjectPath: null,
          visualIdentityOnly: true,
          bodyGeometryAuthority: false,
          medicalScan: false,
        },
        geometry: {
          status: "unknown",
          source: "none",
          providerKey: null,
          measuredAt: null,
          mayDriveBodyMetrics: true,
          medicalScan: false,
        },
      }),
    ).toThrow("PERSONALIZED_TWIN_UNKNOWN_GEOMETRY_CANNOT_DRIVE_METRICS");
  });
});
