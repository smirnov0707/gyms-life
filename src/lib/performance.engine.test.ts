import test from "node:test";
import assert from "node:assert/strict";
import { calculateAverage, calculateEstimated1RM, calculateVolume } from "./performance.engine";

test("calculates set volume", () => assert.equal(calculateVolume(10, 50), 500));
test("does not calculate volume from missing weight", () => assert.equal(calculateVolume(10, null), 0));
test("calculates estimated 1RM separately from actual weight", () => assert.equal(calculateEstimated1RM(100, 10), 133.3));
test("rejects invalid 1RM inputs", () => assert.equal(calculateEstimated1RM(0, 10), null));
test("calculates rounded averages", () => assert.equal(calculateAverage([7, 8, 9]), 8));
test("returns null for an empty average", () => assert.equal(calculateAverage([]), null));
