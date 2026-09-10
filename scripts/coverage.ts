/** Build a reproducible index from deliberately published research only. No API calls. */
import { readFile, readdir, writeFile } from "node:fs/promises";
import { getCatalog, getAssessments } from "../server/data.js";
import { validateReport } from "../server/investigate.js";
import type { Investigation } from "../shared/schema.js";

const catalog = await getCatalog();
const runs: Investigation[] = [];
for (const file of (await readdir("data/investigations")).sort()) {
  if (!file.endsWith(".json")) continue;
  const run = JSON.parse(
    await readFile(`data/investigations/${file}`, "utf8"),
  ) as Investigation;
  if (run.status !== "completed" || run.provenance !== "recorded")
    throw Error(`Unpublished or incomplete research in public data: ${file}`);
  if (!catalog.candidates.some((candidate) => candidate.id === run.candidateId))
    throw Error(`Unknown candidate in ${file}`);
  validateReport(run, run.sources);
  runs.push(run);
}
runs.sort(
  (a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
);
const assessments = await getAssessments(catalog, runs);
const investigated = new Set(runs.map((run) => run.candidateId)).size;
const domains = ["clinical", "safety", "manufacturing", "regulatory"] as const;
const cell = (value: string) =>
  value.replace(/\|/g, "\\|").replace(/\s+/g, " ");
const rows = catalog.candidates.map((candidate) => {
  const run = runs.find((item) => item.candidateId === candidate.id);
  const assessment = assessments[candidate.id];
  const research = run
    ? `[Reviewed report](../data/investigations/${run.id}.json) · ${run.tools?.length ?? 0} tool calls`
    : assessment
      ? "Initial packet only"
      : "No assessment";
  const states = domains.map(
    (domain) =>
      assessment?.factors.find((factor) => factor.category === domain)?.state ??
      "not assessed",
  );
  const outcome =
    candidate.status === "approved"
      ? "FDA approved (observed)"
      : candidate.status === "complete_response"
        ? "Complete response (observed)"
        : (assessment?.category ?? "not assessed");
  return `| ${cell(candidate.drug)} — ${cell(candidate.indication)} | ${research} | ${outcome} | ${states.join(" | ")} |`;
});
const content = `# Published research coverage

**${investigated} of ${catalog.candidates.length} drug–indication episodes have reviewed Astra investigations**, represented by ${runs.length} recorded runs (repeat challenges count as separate runs, not additional candidates). All ${catalog.candidates.length} episodes have curated public evidence. This index uses only checked-in public records; unfinished attempts and unpublished local reports do not count.

Regulatory catalog snapshot: ${catalog.asOf}. Latest published investigation: ${runs[0]?.createdAt ?? "none"}. Regenerate with \`pnpm research:coverage\`; this command makes no API calls.

The four domain states describe the available evidence, not independent approval probabilities. Unknown means the evidence did not settle that domain. An initial packet interpretation is not a deep investigation. An observed FDA action takes precedence over a prospective outlook; the linked report can still discuss the evidence retrospectively.

| Drug and indication | Research available | Outlook / observed action | Clinical | Safety | Manufacturing | Regulatory |
|---|---|---|---|---|---|---|
${rows.join("\n")}

Tool counts include attempted operations, including failures. A source reference or successful request does not establish scientific correctness. Read the report's source citations, scope and limitations alongside its assessment.

Source-review qualifications accompany the unchanged imlifidase and anito-cel reports in the app and exported briefs. Imlifidase's seven early antibody-mediated rejection cases include six confirmed and one presumed case; anito-cel's fatal CRS event also has primary SEC corroboration missed in the retrieved excerpts. The [additional review ledger](../data/deep-review-expanded-2026-09-10.md) documents the distinctions and original sources.

Review records: [original cases](../data/recorded-run-review.md), [first expanded group](../data/deep-review-2026-09-10.md), [additional cases and recovery attempts](../data/deep-review-expanded-2026-09-10.md). The source review was performed by separate project agents; it is not an independent expert assessment or prospective validation of FDA outcomes.
`;
if (process.argv.includes("--check")) {
  if ((await readFile("docs/research-coverage.md", "utf8")) !== content)
    throw Error(
      "Published research coverage is stale. Run pnpm research:coverage.",
    );
} else {
  await writeFile("docs/research-coverage.md", content);
}
console.log(
  `${investigated}/${catalog.candidates.length} investigated candidates; ${runs.length} published runs.`,
);
