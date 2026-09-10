/** Gather current public evidence, or explicitly publish a reviewed scan. */
import { mkdir, writeFile } from "node:fs/promises";
import "../server/config.js";
import { getCatalog } from "../server/data.js";
import {
  gatherDossier,
  readDossier,
  publicDossier,
} from "../server/dossier.js";
const ids = process.argv.slice(2).filter((x) => !x.startsWith("--"));
const publish = process.argv.includes("--record");
const catalog = await getCatalog();
if (!ids.length)
  throw Error(
    "Pass candidate IDs to gather, or --record plus candidate IDs to publish reviewed scans.",
  );
for (const id of ids) {
  const candidate = catalog.candidates.find((c) => c.id === id);
  if (!candidate) throw Error(`Unknown candidate ${id}`);
  const dossier = publish
    ? await readDossier(id)
    : await gatherDossier(candidate, console.log, {
        refresh: process.argv.includes("--refresh"),
      });
  if (!dossier) throw Error(`No reviewed scan available for ${id}`);
  if (publish) {
    const recorded = publicDossier(dossier);
    recorded.provenance = "recorded";
    // Keep the existing application's dataset local. Share only newly fetched public-API records.
    recorded.families = recorded.families.map((f) =>
      f.id === "fdagent"
        ? {
            ...f,
            status: "not_checked",
            total: null,
            returned: 0,
            sourceIds: [],
            records: [],
            coverage:
              "The local app can query an existing FDAgent MCP installation. Its compliance dataset is not redistributed in this public snapshot.",
          }
        : f,
    );
    recorded.sources = recorded.sources.filter(
      (s) => !s.id.startsWith("fdagent-"),
    );
    await mkdir("data/evidence", { recursive: true });
    await writeFile(
      `data/evidence/${id}.json`,
      JSON.stringify(recorded, null, 2) + "\n",
    );
  }
  console.log(
    JSON.stringify({
      candidate: id,
      recorded: publish,
      sources: dossier.sources.length,
      families: dossier.families.map((f) => ({
        id: f.id,
        status: f.status,
        total: f.total,
        returned: f.returned,
      })),
    }),
  );
}
