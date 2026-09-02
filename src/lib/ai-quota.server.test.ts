import { describe, expect, it, vi } from "vitest";
import { AiQuotaExceededError, reserveAiRequestWithRpc } from "./ai-quota.server";

describe("reserveAiRequestWithRpc", () => {
  it("reserves quota for the authenticated user with the server-owned limit", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });

    await reserveAiRequestWithRpc("7d1c57b8-0df2-4e87-a7a2-e9a2adf0f6aa", rpc);

    expect(rpc).toHaveBeenCalledWith({
      p_user_id: "7d1c57b8-0df2-4e87-a7a2-e9a2adf0f6aa",
      p_limit: 50,
    });
  });

  it("stops a model request when the daily allowance is exhausted", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });

    await expect(
      reserveAiRequestWithRpc("7d1c57b8-0df2-4e87-a7a2-e9a2adf0f6aa", rpc),
    ).rejects.toBeInstanceOf(AiQuotaExceededError);
  });

  it("does not call the model when the quota store is unavailable", async () => {
    const logError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST301" } });

    await expect(
      reserveAiRequestWithRpc("7d1c57b8-0df2-4e87-a7a2-e9a2adf0f6aa", rpc),
    ).rejects.toThrow("AI_QUOTA_UNAVAILABLE");
    expect(logError).toHaveBeenCalledWith("[AI] Could not reserve request quota", {
      code: "PGRST301",
    });
    logError.mockRestore();
  });
});
