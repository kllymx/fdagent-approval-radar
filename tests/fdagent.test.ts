import test from "node:test";
import assert from "node:assert/strict";
import { fdagentArguments, publicFDAgentRecord } from "../server/fdagent.js";

test("FDAgent bridge only permits bounded read datasets and exact FEI facility lookups", () => {
  assert.deepEqual(fdagentArguments("inspections", " Catalent "), { query: "Catalent", limit: 6 });
  assert.deepEqual(fdagentArguments("facility", "3007647000"), { fei: "3007647000" });
  assert.throws(() => fdagentArguments("facility", "Catalent"), /exact FDA FEI/);
  assert.throws(() => fdagentArguments("delete_records" as never, "x"), /Unsupported/);
  assert.throws(() => fdagentArguments("inspections", "x".repeat(161)), /160/);
});

test("FDAgent connector strips database internals and contact/customer fields recursively", () => {
  const result = publicFDAgentRecord({
    _id: "private-row", firmName: "Example public firm", email: "private@example.test",
    inspections: [{ fei: "1234567890", classification: "VAI", customerNote: "private", _creationTime: 1 }],
    userId: "private", fullText: "unbounded internal text",
  });
  assert.deepEqual(result, { firmName: "Example public firm", inspections: [{fei: "1234567890", classification: "VAI"}] });
});
