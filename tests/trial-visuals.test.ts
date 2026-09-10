import assert from "node:assert/strict";
import { test } from "node:test";
import {
  validateTrialVisuals,
  type TrialVisual,
} from "../shared/trial-visuals.js";
import { getCatalog, getTrialVisuals } from "../server/data.js";
import { readFile, readdir } from "node:fs/promises";
import type { Investigation } from "../shared/schema.js";

function visual(): TrialVisual {
  return {
    id: "fixture",
    title: "Trial result",
    study: "Study",
    endpoint: "Change",
    population: "Population",
    timepoint: "Week12",
    unit: "mmHg",
    direction: "lower",
    comparisonLabel: "Randomized groups",
    arms: [
      { label: "Treatment", value: -12, n: 100 },
      { label: "Control", value: -3, n: 100 },
    ],
    effect: {
      label: "Difference",
      value: -9,
      lower: -12,
      upper: -6,
      level: "95% CI",
      unit: "mmHg",
    },
    interpretation: "Test-only chart",
    limitations: ["A unit-test fixture, not clinical data"],
    sourceIds: ["source"],
    sourceNote: "Source",
  };
}
test("clinical charts require known candidate-specific sources and explicit confidence intervals", () => {
  assert.doesNotThrow(() =>
    validateTrialVisuals(
      { candidate: [visual()] },
      { candidate: new Set(["source"]) },
    ),
  );
  assert.throws(
    () =>
      validateTrialVisuals(
        { candidate: [visual()] },
        { candidate: new Set(["different"]) },
      ),
    /reference not linked/,
  );
  const missing = visual();
  delete missing.effect!.level;
  assert.throws(
    () =>
      validateTrialVisuals(
        { candidate: [missing] },
        { candidate: new Set(["source"]) },
      ),
    /interval needs/,
  );
  const inverted = visual();
  inverted.effect!.upper = -11;
  assert.throws(
    () =>
      validateTrialVisuals(
        { candidate: [inverted] },
        { candidate: new Set(["source"]) },
      ),
    /interval needs/,
  );
});
test("public trial visual artifacts validate against recorded candidate sources", async () => {
  const runs: Investigation[] = [];
  for (const file of (await readdir("data/investigations")).filter((f) =>
    f.endsWith(".json"),
  ))
    runs.push(
      JSON.parse(await readFile(`data/investigations/${file}`, "utf8")),
    );
  const data = await getTrialVisuals(await getCatalog(), runs);
  // New deployments without optional chart artifacts remain usable.
  for (const visuals of Object.values(data))
    for (const item of visuals) assert.ok(item.arms.length >= 2);
});
