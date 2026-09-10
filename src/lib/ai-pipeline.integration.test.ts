import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { CentralUserContext } from "./user-context.server";
const io = vi.hoisted(() => ({
  generate: vi.fn(),
  create: vi.fn(),
  quota: vi.fn(),
  record: vi.fn(),
  context: vi.fn(),
  serialize: vi.fn(),
  owns: vi.fn(),
}));
vi.mock("ai", () => ({ generateText: io.generate }));
vi.mock("./ai-gateway.server", () => ({ createAiModel: io.create }));
vi.mock("./ai-quota.server", () => ({ reserveAiRequest: io.quota }));
vi.mock("./observability.server", () => ({ recordObservabilityEvent: io.record }));
vi.mock("./user-context.server", () => ({
  buildUserContext: io.context,
  contextForAi: io.serialize,
  isContextForUser: io.owns,
}));
import {
  generateOrchestratedJson,
  generateOrchestratedText,
  EXECUTABLE_AI_TASKS,
  isVisionTask,
  getAiTaskModelRoute,
  transcribeOrchestratedVoice,
} from "./ai-orchestrator.server";
import { AI_TASK_CONTEXT_SCOPE } from "./ai-task-context";
import {
  generateJson,
  parseAiJson,
  normalizeAiError,
  isAiProviderRecoverable,
} from "./ai-json.server";
import { withAiDeadline } from "./ai-deadline.server";
import { aiSchemaInstruction } from "./ai-response.contract";
import { validateAiInput, parseAudioUpload } from "./ai-media.server";
const USER = "11111111-1111-4111-8111-111111111111";
const IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a51cAAAAASUVORK5CYII=";
const schema = z.object({
  value: z.number().min(1).max(10),
  evidence: z.enum(["stated", "unknown"]),
});
const fakeContext = {} as CentralUserContext;
const client = {} as import("@supabase/supabase-js").SupabaseClient<
  import("@/integrations/supabase/types").Database
>;
const response = { text: '{"value":3,"evidence":"stated"}', finishReason: "stop" };
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AI_ENABLED", "true");
  io.generate.mockReset().mockResolvedValue(response);
  io.create.mockReset().mockImplementation((modelId) => ({ specificationVersion: "v4", modelId }));
  io.context.mockReset().mockResolvedValue(fakeContext);
  io.serialize
    .mockReset()
    .mockReturnValue('{"preferences":{"goal":"test"},"personalization":{"enabled":false}}');
  io.quota.mockReset().mockResolvedValue(undefined);
  io.record.mockReset().mockResolvedValue(undefined);
  io.owns.mockReset().mockReturnValue(true);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("all executable tasks through the real orchestration path", () => {
  it.each(EXECUTABLE_AI_TASKS)(
    "%s gets its declared scope, output contract, deadline and exactly one quota reservation",
    async (task) => {
      const common = { task, userId: USER, supabase: client };
      if (task === "coach.ask") {
        io.generate.mockResolvedValue({ text: "Synthetic answer", finishReason: "stop" });
        expect(await generateOrchestratedText({ ...common, prompt: "synthetic only" })).toBe(
          "Synthetic answer",
        );
      } else {
        const result = await generateOrchestratedJson({
          ...common,
          schema,
          ...(isVisionTask(task)
            ? {
                messages: [
                  {
                    role: "user" as const,
                    content: [
                      { type: "text" as const, text: "synthetic visual fixture" },
                      { type: "image" as const, image: IMAGE },
                    ],
                  },
                ],
              }
            : { prompt: "synthetic only" }),
        });
        expect(result).toEqual({ value: 3, evidence: "stated" });
        expect(io.generate.mock.calls[0]![0].system).toContain('"required":["value","evidence"]');
      }
      expect(io.quota).toHaveBeenCalledExactlyOnceWith(USER);
      expect(io.generate).toHaveBeenCalledTimes(1);
      const request = io.generate.mock.calls[0]![0];
      expect(request.abortSignal).toBeInstanceOf(AbortSignal);
      expect(request.maxRetries).toBe(0);
      if (AI_TASK_CONTEXT_SCOPE[task] === "personalized")
        expect(io.context).toHaveBeenCalledExactlyOnceWith(client, USER);
      else {
        expect(io.context).not.toHaveBeenCalled();
        expect(request.system).not.toContain("CENTRAL USER CONTEXT");
      }
      expect(io.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: "ai.request",
          outcome: "success",
          metadata: expect.objectContaining({ task, attempt_count: 1 }),
        }),
      );
    },
  );
  it("every vision route excludes a text-only backup and every text route has another provider", () => {
    for (const task of EXECUTABLE_AI_TASKS) {
      const route = getAiTaskModelRoute(task);
      expect(new Set(route).size).toBe(route.length);
      expect(route.length).toBeGreaterThan(1);
      if (isVisionTask(task)) expect(route.some((id) => id.startsWith("groq/"))).toBe(false);
    }
  });
  it("an unavailable configured primary can fall back without billing the quota twice", async () => {
    io.generate
      .mockRejectedValueOnce(Object.assign(new Error("Service unavailable"), { status: 503 }))
      .mockResolvedValueOnce(response);
    const result = await generateOrchestratedJson({
      task: "meal-plan",
      userId: USER,
      supabase: client,
      prompt: "fixture",
      schema,
    });
    expect(result.value).toBe(3);
    expect(io.generate).toHaveBeenCalledTimes(2);
    expect(io.quota).toHaveBeenCalledTimes(1);
    expect(io.record).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          attempt_count: 2,
          fallback_from: "google/gemini-3.1-flash-lite",
        }),
      }),
    );
  });
  it("missing primary credentials select only an approved backup and report the actual route", async () => {
    io.create.mockImplementation((id) => {
      if (id.startsWith("google/")) throw new Error("AI_MODEL_UNAVAILABLE:" + id);
      return { specificationVersion: "v4", modelId: id };
    });
    await generateOrchestratedJson({
      task: "workout-request",
      userId: USER,
      supabase: client,
      prompt: "fixture",
      schema,
    });
    expect(io.generate.mock.calls[0]![0].model.modelId).toBe("groq/openai/gpt-oss-120b");
    expect(io.record).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          fallback_from: "google/gemini-2.5-flash",
          attempt_count: 1,
        }),
      }),
    );
  });
  it("all missing providers consume no user quota", async () => {
    io.create.mockImplementation(() => {
      throw new Error("AI_MODEL_UNAVAILABLE");
    });
    await expect(
      generateOrchestratedJson({
        task: "workout-request",
        userId: USER,
        supabase: client,
        prompt: "fixture",
        schema,
      }),
    ).rejects.toThrow("AI_MODEL_UNAVAILABLE");
    expect(io.quota).not.toHaveBeenCalled();
    expect(io.generate).not.toHaveBeenCalled();
  });
  it("quota denial prevents all provider attempts", async () => {
    io.quota.mockRejectedValue(new Error("AI_DAILY_LIMIT"));
    await expect(
      generateOrchestratedJson({
        task: "meal-plan",
        userId: USER,
        supabase: client,
        prompt: "fixture",
        schema,
      }),
    ).rejects.toThrow("AI_DAILY_LIMIT");
    expect(io.generate).not.toHaveBeenCalled();
  });
  it.each(["length", "content-filter", "tool-calls", "error", "other"])(
    "unfinished/refused %s cannot become a successful plan or a weaker fallback",
    async (finishReason) => {
      io.generate.mockResolvedValue({ ...response, finishReason });
      await expect(
        generateOrchestratedJson({
          task: "meal-plan",
          userId: USER,
          supabase: client,
          prompt: "fixture",
          schema,
        }),
      ).rejects.toThrow();
      expect(io.generate).toHaveBeenCalledTimes(1);
      expect(io.record).toHaveBeenCalledWith(expect.objectContaining({ outcome: "failure" }));
    },
  );
  it.each(['{"value":300,"evidence":"stated"}', '{"value":3,"evidence":"stated","days":[{}', ""])(
    "invalid JSON/domain output is not retried through weaker workers: %s",
    async (text) => {
      io.generate.mockResolvedValue({ ...response, text });
      await expect(
        generateOrchestratedJson({
          task: "meal-plan",
          userId: USER,
          supabase: client,
          prompt: "fixture",
          schema,
        }),
      ).rejects.toThrow("AI_INVALID_RESPONSE");
      expect(io.generate).toHaveBeenCalledTimes(1);
    },
  );
  it("central snapshots belonging to another user cannot cross the provider boundary", async () => {
    io.owns.mockReturnValue(false);
    await expect(
      generateOrchestratedJson({
        task: "daily-brief",
        userId: USER,
        centralUserContext: fakeContext,
        prompt: "fixture",
        schema,
      }),
    ).rejects.toThrow("AI_CONTEXT_MISMATCH");
    expect(io.generate).not.toHaveBeenCalled();
    expect(io.quota).not.toHaveBeenCalled();
  });
  it("a builder failure is not replaced by empty fabricated context", async () => {
    io.context.mockRejectedValue(new Error("private database connection information"));
    await expect(
      generateOrchestratedJson({
        task: "meal-plan",
        userId: USER,
        supabase: client,
        prompt: "fixture",
        schema,
      }),
    ).rejects.toThrow("AI_REQUEST_FAILED");
    expect(io.quota).not.toHaveBeenCalled();
    expect(JSON.stringify(io.record.mock.calls)).not.toContain("private database");
  });
  it("disabled AI stops before context or provider side effects", async () => {
    vi.stubEnv("AI_ENABLED", "false");
    await expect(
      generateOrchestratedText({
        task: "coach.ask",
        userId: USER,
        supabase: client,
        prompt: "fixture",
      }),
    ).rejects.toThrow("AI_DISABLED");
    expect(io.context).not.toHaveBeenCalled();
    expect(io.generate).not.toHaveBeenCalled();
  });
  it("conflicting request representations and remote images never reach a provider", async () => {
    await expect(
      generateOrchestratedJson({
        task: "food-vision",
        userId: USER,
        schema,
        messages: [
          { role: "user", content: [{ type: "image", image: "http://127.0.0.1/private" }] },
        ],
      }),
    ).rejects.toThrow("AI_INVALID_MEDIA");
    expect(io.quota).not.toHaveBeenCalled();
    expect(io.generate).not.toHaveBeenCalled();
  });
  it("a provider ignoring cancellation cannot keep the caller pending forever", async () => {
    vi.useFakeTimers();
    io.generate.mockImplementation(() => new Promise(() => {}));
    const task = generateOrchestratedJson({
      task: "meal-plan",
      userId: USER,
      supabase: client,
      prompt: "fixture",
      schema,
    });
    const checked = expect(task).rejects.toThrow("AI_TIMEOUT");
    await vi.advanceTimersByTimeAsync(90_001);
    await checked;
    expect(io.generate.mock.calls.length).toBeLessThanOrEqual(2);
    expect(io.quota).toHaveBeenCalledTimes(1);
  });
});
describe("strict structured responses", () => {
  it("a schema is communicated as well as applied locally, including preprocess fields", () => {
    const instruction = aiSchemaInstruction(
      z.object({ minutes: z.preprocess(Number, z.number().int().min(1)), title: z.string() }),
    );
    expect(instruction).toContain('"minutes"');
    expect(instruction).toContain('"minimum":1');
  });
  it.each([
    '{"items":[{"n":1},{"n":',
    '{"items":[{"n":1}],"partial":',
    '{"items":[{"n":1},]}',
    "{items: [{n: 1}]}",
  ])("does not repair/drop an incomplete tail %s", (text) =>
    expect(() =>
      parseAiJson(text, z.object({ items: z.array(z.object({ n: z.number() })) })),
    ).toThrow(),
  );
  it("preserves valid text punctuation rather than rewriting string content", () => {
    const value = { text: "Oats — 'raw' and “cooked”" };
    expect(parseAiJson(JSON.stringify(value), z.object({ text: z.string() }))).toEqual(value);
  });
  it("bounded deadline clears timers and respects an already cancelled request", async () => {
    const c = new AbortController();
    c.abort(new Error("AI_CANCELLED"));
    const called = vi.fn();
    await expect(withAiDeadline(1000, called, c.signal)).rejects.toThrow("AI_CANCELLED");
    expect(called).not.toHaveBeenCalled();
  });
  it("a schema validation message containing 'insufficient' is not mistaken for provider credits", () =>
    expect(
      isAiProviderRecoverable(
        normalizeAiError(new Error("insufficient fields in structured output")),
      ),
    ).toBe(false));
});
describe("voice adapter boundaries", () => {
  it.each(["lt", "en", "ru", "uk", "pl", "de", "es", "fr"] as const)(
    "preserves supported transcription language %s and actual MP4 file type",
    async (language) => {
      vi.stubEnv("GROQ_API_KEY", "synthetic-key-only");
      const fetch = vi.fn().mockResolvedValue(Response.json({ text: "Synthetic spoken set" }));
      vi.stubGlobal("fetch", fetch);
      const result = await transcribeOrchestratedVoice({
        userId: USER,
        audioBase64: "data:audio/mp4;base64,AQID",
        mimeType: "audio/mp4",
        language,
      });
      expect(result).toBe("Synthetic spoken set");
      const options = fetch.mock.calls[0]![1];
      expect(options.body.get("language")).toBe(language);
      expect(options.body.get("file").name).toBe("workout-audio.m4a");
      expect(options.signal).toBeInstanceOf(AbortSignal);
      expect(io.quota).toHaveBeenCalledTimes(1);
    },
  );
  it.each([429, 503, 401])(
    "provider voice refusal %s becomes a stable error, not an empty successful transcript",
    async (status) => {
      vi.stubEnv("GROQ_API_KEY", "synthetic-key-only");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response("private provider text", { status })),
      );
      await expect(
        transcribeOrchestratedVoice({
          userId: USER,
          audioBase64: "AQID",
          mimeType: "audio/webm",
          language: "lt",
        }),
      ).rejects.toThrow(/^AI_/);
    },
  );
  it("rejects malformed base64 before quota or networking", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      transcribeOrchestratedVoice({
        userId: USER,
        audioBase64: "data:audio/mp4;base64,%%%",
        mimeType: "audio/mp4",
        language: "lt",
      }),
    ).rejects.toThrow("AI_INVALID_MEDIA");
    expect(fetch).not.toHaveBeenCalled();
    expect(io.quota).not.toHaveBeenCalled();
  });
  it("voice refusal and missing input remain unavailable rather than fake text", async () => {
    vi.stubEnv("GROQ_API_KEY", "synthetic-key-only");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ text: "" })));
    await expect(
      transcribeOrchestratedVoice({
        userId: USER,
        audioBase64: "AQID",
        mimeType: "audio/webm",
        language: "lt",
      }),
    ).rejects.toThrow("AI_INVALID_RESPONSE");
  });
});
