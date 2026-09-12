import { describe, expect, it, vi } from "vitest";
import { deletePersonalizedTwin } from "./personalized-twin.delete.service";

describe("Personalized Twin deletion", () => {
  it("removes private inputs and model before deleting the owned DB row", async () => {
    const calls: string[] = [];
    const persistence = {
      loadOwnedCapture: vi.fn(async () => ({
        captureSetId: "capture-1",
        userId: "user-1",
        inputObjectPaths: ["in/front.jpg", "in/side.jpg", "in/front.jpg"],
        modelObjectPath: "models/avatar.glb",
      })),
      deleteCaptureSet: vi.fn(async () => {
        calls.push("delete-row");
      }),
    };
    const storage = {
      removeInputs: vi.fn(async () => {
        calls.push("remove-inputs");
      }),
      removeModels: vi.fn(async () => {
        calls.push("remove-model");
      }),
    };

    await expect(
      deletePersonalizedTwin({
        captureSetId: "capture-1",
        userId: "user-1",
        persistence,
        storage,
      }),
    ).resolves.toEqual({ deleted: true });

    expect(storage.removeInputs).toHaveBeenCalledWith(["in/front.jpg", "in/side.jpg"]);
    expect(calls).toEqual(["remove-inputs", "remove-model", "delete-row"]);
  });
  it("keeps the DB row when Storage cleanup fails so deletion can be retried", async () => {
    const persistence = {
      loadOwnedCapture: vi.fn(async () => ({
        captureSetId: "capture-1",
        userId: "user-1",
        inputObjectPaths: ["in/front.jpg"],
        modelObjectPath: "models/avatar.glb",
      })),
      deleteCaptureSet: vi.fn(async () => undefined),
    };
    const storage = {
      removeInputs: vi.fn(async () => {
        throw new Error("storage unavailable");
      }),
      removeModels: vi.fn(async () => undefined),
    };

    await expect(
      deletePersonalizedTwin({
        captureSetId: "capture-1",
        userId: "user-1",
        persistence,
        storage,
      }),
    ).rejects.toThrow("storage unavailable");
    expect(persistence.deleteCaptureSet).not.toHaveBeenCalled();
    expect(storage.removeModels).not.toHaveBeenCalled();
  });

  it("is idempotent when the capture set is already gone", async () => {
    const persistence = {
      loadOwnedCapture: vi.fn(async () => null),
      deleteCaptureSet: vi.fn(async () => undefined),
    };
    const storage = {
      removeInputs: vi.fn(async () => undefined),
      removeModels: vi.fn(async () => undefined),
    };

    await expect(
      deletePersonalizedTwin({
        captureSetId: "capture-1",
        userId: "user-1",
        persistence,
        storage,
      }),
    ).resolves.toEqual({ deleted: false });

    expect(storage.removeInputs).not.toHaveBeenCalled();
    expect(storage.removeModels).not.toHaveBeenCalled();
    expect(persistence.deleteCaptureSet).not.toHaveBeenCalled();
  });
});
