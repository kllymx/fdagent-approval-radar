import {
  readFile,
  mkdir,
  writeFile,
  copyFile,
  readdir,
} from "node:fs/promises";
import { getCatalog, getModel, getAssessments } from "../server/data.js";
import type { Investigation, Source } from "../shared/schema.js";
import { listDossiers, readDossier, publicDossier } from "../server/dossier.js";
await mkdir("dist/demo/investigations", { recursive: true });
const runs: Investigation[] = [];
for (const file of (await readdir("data/investigations")).filter((f) =>
  f.endsWith(".json"),
)) {
  const run = JSON.parse(await readFile("data/investigations/" + file, "utf8"));
  run.provenance = "recorded";
  runs.push(run);
  await writeFile("dist/demo/investigations/" + file, JSON.stringify(run));
}
runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
const evidenceCandidateIds = await listDossiers(true);
const evidenceSourcesByCandidate: Record<string, Source[]> = {};
await mkdir("dist/demo/evidence", { recursive: true });
for (const id of evidenceCandidateIds) {
  const dossier = await readDossier(id, true);
  if (dossier) {
    evidenceSourcesByCandidate[id] = publicDossier(dossier).sources;
    await writeFile(
      `dist/demo/evidence/${id}.json`,
      JSON.stringify(publicDossier(dossier)),
    );
  }
}
for (const run of [...runs].reverse())
  evidenceSourcesByCandidate[run.candidateId] = [
    ...new Map(
      [
        ...(evidenceSourcesByCandidate[run.candidateId] || []),
        ...run.sources,
      ].map((source) => [source.id, source]),
    ).values(),
  ];
for (const id of evidenceCandidateIds) {
  const dossier = await readDossier(id, true);
  if (dossier)
    evidenceSourcesByCandidate[id] = [
      ...new Map(
        [
          ...(evidenceSourcesByCandidate[id] || []),
          ...publicDossier(dossier).sources,
        ].map((source) => [source.id, source]),
      ).values(),
    ];
}
const catalog = await getCatalog();
const payload = {
  catalog,
  assessments: await getAssessments(catalog, runs),
  model: await getModel(),
  evidenceCandidateIds,
  evidenceSourcesByCandidate,
  runtime: {
    configured: false,
    fdagent: false,
    model: "gpt-6-astra",
    provider: "OpenAI",
    status: "unconfigured",
    message:
      "Public demo — recorded Astra runs. Run locally with Astra access for live research.",
  },
  investigations: runs.map(
    ({ id, candidateId, model, createdAt, mode, provenance, summary }) => ({
      id,
      candidateId,
      model,
      createdAt,
      mode,
      provenance,
      summary,
    }),
  ),
};
await writeFile("dist/demo/dashboard.json", JSON.stringify(payload));
await writeFile("dist/.nojekyll", "");
await copyFile("dist/index.html", "dist/404.html");
console.log(
  `Built public demo with ${runs.length} genuine recorded Astra investigations; no runtime credentials.`,
);
