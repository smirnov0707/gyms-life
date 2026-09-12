import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { Lang } from "@/lib/i18n";
import type { getWorkoutHistory } from "@/lib/workout-history.functions";
import { WorkoutHistoryPage } from "./history";

type HistoryData = Awaited<ReturnType<typeof getWorkoutHistory>>;
const state = vi.hoisted(() => {
  const current: {
    lang: Lang;
    userId: string | null;
    query: { data: HistoryData | undefined; isLoading: boolean; isError: boolean };
    options: Mock<(options: unknown) => void>;
  } = {
    lang: "en",
    userId: "athlete-a",
    query: { data: { sessions: [] }, isLoading: false, isError: false },
    options: vi.fn<(options: unknown) => void>(),
  };
  return current;
});

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => {
    state.options(options);
    return state.query;
  },
}));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: state.userId ? { id: state.userId } : null }),
}));
vi.mock("@/lib/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/i18n")>()),
  useI18n: () => ({ lang: state.lang, t: (key: string) => key }),
}));
vi.mock("@/lib/workout-history.functions", () => ({ getWorkoutHistory: vi.fn() }));
vi.mock("@/components/future-lab/JournalIntelligence", () => ({ JournalIntelligence: () => null }));

describe("Journal workout history presentation", () => {
  beforeEach(() => {
    state.lang = "en";
    state.userId = "athlete-a";
    state.query = { data: { sessions: [] }, isLoading: false, isError: false };
    state.options.mockClear();
  });

  it.each(["en", "de"] as const)(
    "uses English history copy for %s without another main landmark",
    (lang) => {
      state.lang = lang;
      const html = renderToStaticMarkup(<WorkoutHistoryPage />);
      expect(html).toContain("No completed workouts yet");
      expect(html).toContain("Your completed workouts and recorded sets.");
      expect(html).not.toContain("Tavo užbaigtos");
      expect(html).not.toContain("<main");
    },
  );

  it("retains Lithuanian history copy for Lithuanian", () => {
    state.lang = "lt";
    expect(renderToStaticMarkup(<WorkoutHistoryPage />)).toContain("Dar nėra užbaigtų treniruočių");
  });

  it("distinguishes an unreadable history from a readable empty history", () => {
    state.query = { data: undefined, isLoading: false, isError: true };
    const html = renderToStaticMarkup(<WorkoutHistoryPage />);
    expect(html).toContain("Workout history could not be loaded.");
    expect(html).not.toContain("No completed workouts yet");
  });

  it("does not report empty history before a read has completed", () => {
    state.query = { data: undefined, isLoading: true, isError: false };
    const html = renderToStaticMarkup(<WorkoutHistoryPage />);
    expect(html).toContain("Loading workout history…");
    expect(html).not.toContain("No completed workouts yet");
  });

  it("separates cached history by authenticated athlete and disables signed-out reads", () => {
    renderToStaticMarkup(<WorkoutHistoryPage />);
    expect(state.options).toHaveBeenLastCalledWith(
      expect.objectContaining({ queryKey: ["workout-history", "athlete-a"], enabled: true }),
    );
    state.userId = "athlete-b";
    renderToStaticMarkup(<WorkoutHistoryPage />);
    expect(state.options).toHaveBeenLastCalledWith(
      expect.objectContaining({ queryKey: ["workout-history", "athlete-b"], enabled: true }),
    );
    state.userId = null;
    renderToStaticMarkup(<WorkoutHistoryPage />);
    expect(state.options).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));
  });
});
