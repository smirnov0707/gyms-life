import { describe, expect, it } from "vitest";
import { sculptSeamWeights, SCULPT_SEAM_WIDTH_M } from "./authoring/sculpt-seams.mjs";
const easing = (distance: number, width = SCULPT_SEAM_WIDTH_M) => {
  const t = Math.min(1, distance / width);
  return t * t * (3 - 2 * t);
};
describe("surface-connected smooth seam weights", () => {
  it("feathers across multiple graph edges and saturates outside the 12 mm band", () => {
    const p = Array.from({ length: 9 }, (_, i) => [i * 0.003, 0, 0]);
    const graph = p.map((_, i) => new Set([i - 1, i + 1].filter((j) => j >= 0 && j < p.length)));
    const result = sculptSeamWeights(p, graph, [0]);
    result.forEach((value: number, i: number) => expect(value).toBeCloseTo(easing(i * 0.003), 12));
    expect(result[0]).toBe(0);
    expect(result[2]).toBe(0.5);
    expect(result[8]).toBe(1);
  });
  it("does not transfer a boundary tint to a nearby disconnected surface", () => {
    const p = [
      [0, 0, 0],
      [0.004, 0, 0],
      [0.00001, 0, 0],
      [0.00401, 0, 0],
    ];
    const result = sculptSeamWeights(
      p,
      [new Set([1]), new Set([0]), new Set([3]), new Set([2])],
      [0],
    );
    expect(result[0]).toBe(0);
    expect(result[1]).toBeLessThan(1);
    expect(result.slice(2)).toEqual([1, 1]);
  });
  it("matches an independent all-pairs reference for competing short and long paths", () => {
    const p = Array.from({ length: 12 }, (_, i) => [
      0.002 * (i % 4),
      0.002 * Math.floor(i / 4),
      0.0004 * Math.sin(i),
    ]);
    const graph = p.map(
      (_, i) =>
        new Set(p.map((_, j) => j).filter((j) => Math.abs(i - j) === 1 || Math.abs(i - j) === 4)),
    );
    const distance = p.map((_, i) =>
      p.map((_, j) =>
        i === j
          ? 0
          : graph[i]!.has(j)
            ? Math.hypot(...p[i]!.map((v, k) => v - p[j]![k]!))
            : Infinity,
      ),
    );
    for (let k = 0; k < p.length; k++)
      for (let i = 0; i < p.length; i++)
        for (let j = 0; j < p.length; j++)
          distance[i]![j] = Math.min(distance[i]![j]!, distance[i]![k]! + distance[k]![j]!);
    const result = sculptSeamWeights(p, graph, [0, 11, 0]);
    result.forEach((value: number, i: number) =>
      expect(value).toBeCloseTo(easing(Math.min(distance[0]![i]!, distance[11]![i]!)), 12),
    );
  });
  it.each([0, -0.01, 0.031, Number.NaN, Infinity])("rejects unsafe band width %s", (width) => {
    expect(() => sculptSeamWeights([[0, 0, 0]], [new Set()], [], width)).toThrow();
  });
  it("rejects invalid boundary indices and non-finite or collapsed edges", () => {
    expect(() => sculptSeamWeights([[0, 0, 0]], [new Set()], [-1])).toThrow();
    expect(() =>
      sculptSeamWeights(
        [
          [0, 0, 0],
          [0, 0, 0],
        ],
        [new Set([1]), new Set([0])],
        [0],
      ),
    ).toThrow();
    expect(() => sculptSeamWeights([[0, 0, 0]], [], [])).toThrow();
  });
});
