import { describe, expect, it } from "vitest";
import { formatSessionReplayValue } from "./session-replay.model";
describe("session replay units and Lithuanian inflection", () => {
  it.each([
    [1, "1 setas"],
    [2, "2 setai"],
    [10, "10 setų"],
    [11, "11 setų"],
    [12, "12 setų"],
    [21, "21 setas"],
    [22, "22 setai"],
  ] as const)("formats %s set records", (count, expected) => {
    expect(formatSessionReplayValue(count, "session_sets", "lt")).toBe(expected);
  });
  it("uses the selected locale for volume units", () => {
    expect(formatSessionReplayValue(800, "session_volume", "lt")).toBe("800 kg × pakart.");
    expect(formatSessionReplayValue(800, "session_volume", "en")).toBe("800 kg × reps");
  });
});
