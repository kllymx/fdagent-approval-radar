import { investigate } from "../server/investigate.js";
const candidateId = process.argv[2];
if (!candidateId)
  throw Error(
    "Usage: pnpm exec tsx scripts/investigate.ts CANDIDATE_ID [QUESTION]",
  );
const run = await investigate(
  { candidateId, question: process.argv[3] },
  (event) => {
    if (event.type === "complete") return;
    if (event.type === "finding") return;
    console.log(JSON.stringify(event));
  },
  AbortSignal.timeout(8 * 60_000),
);
console.log(
  JSON.stringify({
    id: run.id,
    model: run.model,
    summary: run.summary,
    durationMs: run.durationMs,
    usage: run.usage,
    findings: run.findings.length,
    tools: run.tools?.length,
  }),
);
