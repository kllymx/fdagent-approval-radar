/** Resume a bounded catalog-wide research pass. Publication remains a separate reviewed step. */
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { getCatalog, listInvestigations } from "../server/data.js";
import { investigate } from "../server/investigate.js";

const catalog = await getCatalog();
const existing = await listInvestigations();
const requested = process.argv.slice(2);
const known = new Set(
  existing
    .filter((r) => r.status === "completed" && (r.tools?.length ?? 0) >= 4)
    .map((r) => r.candidateId),
);
const candidates = catalog.candidates
  .filter((c) =>
    requested.length ? requested.includes(c.id) : !known.has(c.id),
  )
  .sort(
    (a, b) =>
      Number(a.status === "approved") - Number(b.status === "approved") ||
      (a.targetDate ?? "9999").localeCompare(b.targetDate ?? "9999"),
  );
await mkdir(".runtime", { recursive: true, mode: 0o700 });
const manifestPath = ".runtime/deep-batch.json";
type Item = {
  candidateId: string;
  status: "queued" | "running" | "completed" | "failed";
  attempts: number;
  runId?: string;
  error?: string;
  category?: string;
  createdAt?: string;
};
let previous: Item[] = [];
try {
  previous = JSON.parse(await readFile(manifestPath, "utf8")).items;
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
}
const items = candidates.map(
  (c) =>
    previous.find((i) => i.candidateId === c.id && i.status === "completed") ??
    ({ candidateId: c.id, status: "queued", attempts: 0 } as Item),
);
const startedAt = new Date().toISOString();
let writes = Promise.resolve();
function save() {
  const content =
    JSON.stringify(
      {
        startedAt,
        scope:
          "Full evidence investigation; source review required before publication",
        items,
      },
      null,
      2,
    ) + "\n";
  writes = writes.then(async () => {
    const temp = manifestPath + "." + randomUUID() + ".tmp";
    await writeFile(temp, content, { mode: 0o600 });
    await rename(temp, manifestPath);
  });
  return writes;
}
await save();
let cursor = 0;
async function worker() {
  while (cursor < candidates.length) {
    const index = cursor++,
      candidate = candidates[index],
      item = items[index];
    if (item.status === "completed") continue;
    const question = `Conduct deep due diligence across all four domains for ${candidate.drug}, specifically ${candidate.indication}. ${candidate.status === "approved" ? "This episode is already approved: analyze the observed evidence and remaining risks retrospectively; do not portray it as a successful prospective prediction." : "Assess the current FDA application and what could materially change its outcome."}
1. Clinical: retrieve actual pivotal results, not just the announcement of an accepted filing. Identify design, comparator, population, prespecified primary endpoints, effect sizes and uncertainty, durability, replication and relevant statistical limitations. Inspect trial registry results or original papers where available.
2. Safety: inspect candidate-specific adverse-event results, exposure, serious events, discontinuations, dose/population effects, and practical monitoring questions. Distinguish no discussion from reassuring observed evidence.
3. Manufacturing: investigate documented CMC setbacks, named manufacturers/sites and current corrective actions. Use FDAgent public inspections/warning letters if useful, but verify original sources and drug-site links. A sponsor/BIMO inspection is not CGMP clearance. Missing records are unknown.
4. Regulatory and sponsor history: verify current application status, original-versus-supplement/resubmission, requested indication, target changes, prior CRLs and specific FDA objections. Check relevant prior approved products or indications and timeline experience when documented; do not treat company-wide track record as a validated approval predictor or infer site linkage. Distinguish completed prior actions from this application.
Read both supportive and contrary sources, resolve superseded facts, and identify the single pivotal unresolved question. Return a substantive decision brief and evidenceAssessment covering every domain with citations and concrete limitations. When a domain lacks public data, document what was searched and what specific document would resolve it. Stay within the bounded research tools: prioritize substantive source reading over repetitive broad searches. No invented probabilities, no inferred FDA clearance, no unrelated-indication evidence substituted for the current claim.`;
    for (let attempt = 0; attempt < 2; attempt++) {
      item.status = "running";
      item.attempts++;
      delete item.error;
      await save();
      console.log(
        JSON.stringify({
          candidateId: candidate.id,
          status: "started",
          attempt: item.attempts,
        }),
      );
      try {
        const run = await investigate(
          { candidateId: candidate.id, question },
          (event) => {
            if (event.type === "started") item.runId = String(event.runId);
            if (
              event.type === "progress" &&
              ["tool", "verification"].includes(String(event.stage))
            )
              console.log(
                JSON.stringify({ candidateId: candidate.id, ...event }),
              );
          },
          AbortSignal.timeout(8 * 60_000),
        );
        Object.assign(item, {
          status: "completed",
          runId: run.id,
          category: run.evidenceAssessment?.category,
          createdAt: run.createdAt,
        });
        console.log(
          JSON.stringify({
            candidateId: candidate.id,
            status: "completed",
            runId: run.id,
            category: item.category,
            durationMs: run.durationMs,
          }),
        );
        await save();
        break;
      } catch (e) {
        item.status = "failed";
        item.error = e instanceof Error ? e.message : String(e);
        await save();
        console.error(
          JSON.stringify({
            candidateId: candidate.id,
            status: "failed",
            attempt: item.attempts,
            error: item.error,
          }),
        );
      }
    }
  }
}
await Promise.all(
  Array.from({ length: Math.min(3, candidates.length) }, () => worker()),
);
await writes;
console.log(
  JSON.stringify({
    completed: items.filter((i) => i.status === "completed").length,
    failed: items.filter((i) => i.status === "failed").length,
    previouslyInvestigated: known.size,
  }),
);
if (items.some((i) => i.status === "failed")) process.exitCode = 1;
