import { test } from "node:test";
import assert from "node:assert/strict";
import {
  factorCategories,
  validateAssessment,
  type EvidenceAssessment,
} from "../shared/assessment.js";

function fixture(): EvidenceAssessment {
  return {
    category: "insufficient",
    summary: "Only filing details are present.",
    pivotalQuestion: "What do the pivotal results show?",
    sourceIds: ["filing"],
    factors: factorCategories.map((category) => ({
      category,
      state: "unknown",
      rationale: "Not assessed in this packet.",
      sourceIds: [],
    })),
  };
}
test("absence of evidence remains unknown and cannot become a directional outlook", () => {
  const value = fixture();
  assert.doesNotThrow(() => validateAssessment(value, ["filing"]));
  for (const category of ["favorable", "mixed", "concerning"] as const) {
    assert.throws(
      () => validateAssessment({ ...value, category }, ["filing"]),
      /Unknown evidence/,
    );
  }
});
test("filing acceptance alone cannot become favorable clinical evidence", () => {
  const value = fixture();
  value.factors[3] = {
    ...value.factors[3],
    state: "supportive",
    sourceIds: ["filing"],
  };
  assert.doesNotThrow(() => validateAssessment(value, ["filing"]));
  assert.throws(
    () => validateAssessment({ ...value, category: "favorable" }, ["filing"]),
    /clinical evidence/,
  );
});
test("supportive clinical results can be favorable while safety and manufacturing stay unknown", () => {
  const value = fixture();
  value.category = "favorable";
  value.factors[0] = {
    ...value.factors[0],
    state: "supportive",
    sourceIds: ["trial"],
  };
  assert.doesNotThrow(() => validateAssessment(value, ["filing", "trial"]));
  value.factors[2] = {
    ...value.factors[2],
    state: "concern",
    sourceIds: ["letter"],
  };
  assert.throws(
    () => validateAssessment(value, ["filing", "trial", "letter"]),
    /unresolved material concern/,
  );
  value.category = "mixed";
  assert.doesNotThrow(() =>
    validateAssessment(value, ["filing", "trial", "letter"]),
  );
});
test("directional factors and overall labels require known supporting evidence", () => {
  const value = fixture();
  value.category = "concerning";
  value.factors[0].state = "concern";
  assert.throws(
    () => validateAssessment(value, ["filing"]),
    /requires supporting sources/,
  );
  value.factors[0].sourceIds = ["fabricated"];
  assert.throws(() => validateAssessment(value, ["filing"]), /unknown source/);
  value.factors[0].sourceIds = ["filing"];
  assert.doesNotThrow(() => validateAssessment(value, ["filing"]));
  value.factors[0].state = "mixed";
  assert.throws(
    () => validateAssessment(value, ["filing"]),
    /identified evidence concern/,
  );
});
test("repeating a favorable factor cannot hide a missing domain", () => {
  const value = fixture();
  value.factors[1].category = "clinical";
  assert.throws(
    () => validateAssessment(value, ["filing"]),
    /four evidence factors once/,
  );
});

import { readFile, readdir } from "node:fs/promises";
import { getCatalog, getAssessments } from "../server/data.js";
import { assessmentPacket } from "../server/assessment-packet.js";
import type { Investigation } from "../shared/schema.js";
import type { Assessment } from "../shared/assessment.js";

test("recorded assessment evidence references and fingerprints match their exact public input packets", async () => {
  const catalog = await getCatalog();
  for (const file of (await readdir("data/assessments")).filter((f) =>
    f.endsWith(".json"),
  )) {
    const record = JSON.parse(
      await readFile(`data/assessments/${file}`, "utf8"),
    ) as Assessment;
    const candidate = catalog.candidates.find(
      (c) => c.id === record.candidateId,
    );
    assert.ok(candidate, file);
    const previous = record.basedOnRunId
      ? (JSON.parse(
          await readFile(
            `data/investigations/${record.basedOnRunId}.json`,
            "utf8",
          ),
        ) as Investigation)
      : undefined;
    const { packet, inputHash } = assessmentPacket(
      candidate,
      catalog,
      previous,
    );
    assert.equal(
      record.inputHash,
      inputHash,
      `${file}: input changed; regenerate assessment`,
    );
    assert.match(record.model, /^gpt-6-astra/);
    assert.ok(record.responseId);
    assert.equal(record.scope, previous ? "investigation" : "initial_packet");
    assert.doesNotThrow(
      () =>
        validateAssessment(
          record,
          packet.sources.map((s) => s.id),
        ),
      file,
    );
  }
});
test("a source correction or changed clinical claim invalidates the packet fingerprint", async () => {
  const catalog = await getCatalog();
  const candidate = catalog.candidates[0];
  const original = assessmentPacket(candidate, catalog);
  const corrected = structuredClone(catalog);
  corrected.sources.find((s) => s.id === candidate.sourceIds[0])!.summary =
    "Corrected evidence fixture";
  assert.notEqual(
    assessmentPacket(candidate, corrected).inputHash,
    original.inputHash,
  );
  assert.notEqual(
    assessmentPacket(
      { ...candidate, summary: "Revised clinical summary fixture" },
      catalog,
    ).inputHash,
    original.inputHash,
  );
});

test("an unrelated newer report or corrected catalog withholds stale labels without breaking the dashboard", async () => {
  const catalog = await getCatalog();
  const runs: Investigation[] = [];
  for (const file of (await readdir("data/investigations")).filter((f) =>
    f.endsWith(".json"),
  ))
    runs.push(
      JSON.parse(await readFile(`data/investigations/${file}`, "utf8")),
    );
  const original = await getAssessments(catalog, runs);
  assert.ok(original["apitegromab-sma"]);
  const previous = runs.find((r) => r.candidateId === "apitegromab-sma")!;
  const newer = {
    ...previous,
    id: "new-test-report",
    createdAt: "2026-09-11T00:00:00Z",
    evidenceAssessment: undefined,
    sources: [],
  };
  const updated = await getAssessments(catalog, [...runs, newer]);
  assert.equal(updated["apitegromab-sma"], undefined);
  assert.ok(updated["bezuclastinib-gist"]);
  const changed = structuredClone(catalog);
  changed.candidates.find((c) => c.id === "bezuclastinib-gist")!.summary =
    "A corrected packet";
  assert.equal(
    (await getAssessments(changed, runs))["bezuclastinib-gist"],
    undefined,
  );
});

test("the newest completed investigation supplies the live assessment and exact model provenance", async () => {
  const catalog = await getCatalog();
  const run: Investigation = JSON.parse(
    await readFile(
      "data/investigations/81c770af-1792-4d25-9124-b9c01b983dfb.json",
      "utf8",
    ),
  );
  const records = await getAssessments(catalog, [run]);
  assert.equal(
    records[run.candidateId].category,
    run.evidenceAssessment!.category,
  );
  assert.equal(records[run.candidateId].scope, "investigation");
  assert.equal(records[run.candidateId].basedOnRunId, run.id);
  assert.equal(
    records[run.candidateId].responseId,
    run.assessmentProvenance!.responseId,
  );
});
