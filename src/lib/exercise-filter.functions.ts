import { isAiConfigured } from "./ai-gateway.server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  prompt: z.string().min(2).max(300),
  lang: z.string().default("lt"),
});

const Schema = z.object({
  group: z.string().optional().default("all"),
  level: z.string().optional().default("all"),
  equipment: z.string().optional().default("all"),
  safety: z.string().optional().default("all"),
  query: z.string().optional().default(""),
});

/** Turns a free-text wish ("kojos su guma namuose") into exercise-library filters. */
export const smartExerciseFilter = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const empty = { group: "all", level: "all", equipment: "all", safety: "all", query: "" };
    if (!isAiConfigured()) return empty;

    const { generateJson } = await import("./ai-json.server");
    const { createAiRouterProvider } = await import("./ai-gateway.server");
    const gateway = createAiRouterProvider("exercise-filter.functions");

    try {
      const res = await generateJson(gateway("google/gemini-3.1-flash-lite"), {
        system: `You map a user's fitness request to filters of an exercise library. Answer ONLY with JSON.
group: all|legs|chest|back|shoulders|arms|abs|core|glutes|cardio|fullbody|mobility
level: all|beginner|intermediate|advanced
equipment: all|bodyweight|barbell|dumbbell|kettlebell|band|machine|cable|pullup_bar|trx|ball|cardio|other
safety: all|knee_safe|back_safe|shoulder_safe
query: optional 1-2 word search term (exercise name) or empty string.
Use "all" whenever the request does not clearly specify that dimension.`,
        schema: Schema,
        maxOutputTokens: 300,
        prompt: `User request (language ${data.lang}): ${data.prompt}`,
      });
      return { ...empty, ...res };
    } catch {
      return empty;
    }
  });
