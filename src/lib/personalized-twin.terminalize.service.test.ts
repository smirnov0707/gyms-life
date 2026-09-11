import { describe, expect, it, vi } from "vitest";
import { finalizePersonalizedTwinProviderResult } from "./personalized-twin.terminalize.service";

const now = () => new Date("2026-09-11T06:30:00.000Z");

describe("Personalized Twin terminalization", () => {
  it("stores the model, deletes raw inputs, then marks ready", async () => {
    const calls: string[] = [];
    const persistence = {
      markReady: vi.fn(async () => {
        calls.push("mark-ready");
      }),
      markFailed: vi.fn(async () => {
        calls.push("mark-failed");
      }),
    };
    const storage = {
      putModel: vi.fn(async () => {
        calls.push("put-model");
      }),
      removeInputs: vi.fn(async () => {
        calls.push("remove-inputs");
      }),
      removeModels: vi.fn(async () => {
        calls.push("remove-model");
      }),
    };
    await finalizePersonalizedTwinProviderResult({
      userId: "user-1",
      captureSetId: "capture-1",
      rawInputPaths: ["user-1/capture-1/front.jpg"],
      result: { status: "ready", modelBytes: new Uint8Array([1, 2, 3]) },
      persistence,
      storage,
      now,
    });

    expect(calls).toEqual(["put-model", "remove-inputs", "mark-ready"]);
    expect(storage.removeModels).not.toHaveBeenCalled();
    expect(persistence.markReady).toHaveBeenCalledWith({
      userId: "user-1",
      captureSetId: "capture-1",
      inputDeletedAt: "2026-09-11T06:30:00.000Z",
      modelObjectPath: "user-1/capture-1/avatar.glb",
    });
  });
  it("does not publish ready and removes the generated model if raw cleanup fails", async () => {
    const persistence = {
      markReady: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined),
    };
    const storage = {
      putModel: vi.fn(async () => undefined),
      removeInputs: vi.fn(async () => {
        throw new Error("storage unavailable");
      }),
      removeModels: vi.fn(async () => undefined),
    };

    await expect(
      finalizePersonalizedTwinProviderResult({
        userId: "user-1",
        captureSetId: "capture-1",
        rawInputPaths: ["user-1/capture-1/front.jpg"],
        result: { status: "ready", modelBytes: new Uint8Array([1]) },
        persistence,
        storage,
        now,
      }),
    ).rejects.toThrow("storage unavailable");
    expect(persistence.markReady).not.toHaveBeenCalled();
    expect(storage.removeModels).toHaveBeenCalledWith(["user-1/capture-1/avatar.glb"]);
  });

  it("deletes raw inputs before marking a failed provider job terminal", async () => {
    const calls: string[] = [];
    const persistence = {
      markReady: vi.fn(async () => {
        calls.push("mark-ready");
      }),
      markFailed: vi.fn(async () => {
        calls.push("mark-failed");
      }),
    };
    const storage = {
      putModel: vi.fn(async () => {
        calls.push("put-model");
      }),
      removeInputs: vi.fn(async () => {
        calls.push("remove-inputs");
      }),
      removeModels: vi.fn(async () => {
        calls.push("remove-model");
      }),
    };

    await finalizePersonalizedTwinProviderResult({
      userId: "user-1",
      captureSetId: "capture-1",
      rawInputPaths: ["user-1/capture-1/front.jpg"],
      result: { status: "failed", errorCode: "PROVIDER_REJECTED" },
      persistence,
      storage,
      now,
    });
    expect(calls).toEqual(["remove-inputs", "mark-failed"]);
    expect(persistence.markFailed).toHaveBeenCalledWith({
      userId: "user-1",
      captureSetId: "capture-1",
      inputDeletedAt: "2026-09-11T06:30:00.000Z",
      errorCode: "PROVIDER_REJECTED",
    });
  });
});
