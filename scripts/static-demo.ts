import {
  readFile,
  mkdir,
  writeFile,
  copyFile,
  readdir,
} from "node:fs/promises";
import { getCatalog, getModel } from "../server/data.js";
import type { Investigation } from "../shared/schema.js";
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
const payload = {
  catalog: await getCatalog(),
  model: await getModel(),
  runtime: {
    configured: false,
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
