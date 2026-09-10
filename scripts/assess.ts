/** Real Astra packet interpretation. No web retrieval; source-summary scope is preserved. */
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, readdir, rename } from "node:fs/promises";
import { config } from "../server/config.js";
import { getCatalog } from "../server/data.js";
import { assessmentPacket } from "../server/assessment-packet.js";
import {
  ASSESSMENT_POLICY,
  evidenceAssessmentSchema,
  validateAssessment,
  type Assessment,
} from "../shared/assessment.js";
import type { Investigation } from "../shared/schema.js";

if (!config.apiKey || !config.model.startsWith("gpt-6-astra"))
  throw Error(
    "Configured Astra access is required. Model substitution is disabled.",
  );
const catalog = await getCatalog();
const runs: Investigation[] = [];
for (const file of (await readdir("data/investigations")).filter((f) =>
  f.endsWith(".json"),
)) {
  const run = JSON.parse(
    await readFile(`data/investigations/${file}`, "utf8"),
  ) as Investigation;
  if (run.status === "completed") runs.push(run);
}
runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
const selectedIds = process.argv.slice(2);
const candidates = catalog.candidates.filter(
  (c) => selectedIds.length === 0 || selectedIds.includes(c.id),
);
if (!candidates.length) throw Error("No matching candidates.");
await mkdir("data/assessments", { recursive: true });
await mkdir(".runtime/assessments", { recursive: true, mode: 0o700 });
const client = new OpenAI({
  apiKey: config.apiKey,
  baseURL: config.baseUrl,
  timeout: 240_000,
  maxRetries: 1,
});
let index = 0;
let failed = 0;
async function worker() {
  while (index < candidates.length) {
    const candidate = candidates[index++];
    const previous = runs.find((r) => r.candidateId === candidate.id);
    if (previous?.evidenceAssessment) {
      validateAssessment(
        previous.evidenceAssessment,
        previous.sources.map((s) => s.id),
      );
      console.log(
        `${candidate.drug}: latest investigation already includes an assessment`,
      );
      continue;
    }
    const { packet, inputHash } = assessmentPacket(
      candidate,
      catalog,
      previous,
    );
    const { sources } = packet;
    const destination = `data/assessments/${candidate.id}.json`;
    try {
      const old = JSON.parse(await readFile(destination, "utf8"));
      if (old.inputHash === inputHash) {
        console.log(`${candidate.drug}: unchanged packet, retained`);
        continue;
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    const createdAt = new Date().toISOString();
    console.log(
      `${candidate.drug}: assessing ${sources.length} sources${previous ? " and saved investigation" : " (initial packet)"}`,
    );
    try {
      const response = await client.responses.create({
        model: config.model,
        store: false,
        instructions: ASSESSMENT_POLICY,
        input: JSON.stringify(packet),
        reasoning: { effort: "high" },
        max_output_tokens: 10000,
        text: {
          format: zodTextFormat(
            evidenceAssessmentSchema,
            "evidence_assessment",
          ),
        },
      });
      const rawId = randomUUID();
      await writeFile(
        `.runtime/assessments/${rawId}.json`,
        JSON.stringify({ inputHash, packet, response }, null, 2),
        { mode: 0o600 },
      );
      if (response.status !== "completed")
        throw Error(
          `Astra response ${response.status}; retained locally, no assessment published.`,
        );
      if (!response.model.startsWith("gpt-6-astra"))
        throw Error("Provider returned a different model.");
      const assessment = validateAssessment(
        JSON.parse(response.output_text),
        sources.map((s) => s.id),
      );
      const record: Assessment = {
        ...assessment,
        candidateId: candidate.id,
        model: response.model,
        createdAt,
        evidenceAsOf: previous?.createdAt.slice(0, 10) ?? catalog.asOf,
        scope: previous ? "investigation" : "initial_packet",
        basedOnRunId: previous?.id ?? null,
        inputHash,
        responseId: response.id,
        usage: {
          inputTokens: response.usage?.input_tokens ?? 0,
          outputTokens: response.usage?.output_tokens ?? 0,
        },
      };
      const temp = `${destination}.${rawId}.tmp`;
      await writeFile(temp, JSON.stringify(record, null, 2) + "\n");
      await rename(temp, destination);
      console.log(
        `${candidate.drug}: ${assessment.category} (${record.usage!.inputTokens}/${record.usage!.outputTokens} tokens)`,
      );
    } catch (e) {
      failed++;
      console.error(
        `${candidate.drug}: ${e instanceof Error ? e.message : "Failed"}`,
      );
    }
  }
}
await Promise.all(
  Array.from({ length: Math.min(4, candidates.length) }, () => worker()),
);
if (failed) {
  console.error(`${failed} assessments failed; no substitutes generated.`);
  process.exitCode = 1;
}
