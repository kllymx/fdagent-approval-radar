/** Publish only explicitly selected, reviewed runs; never copy raw source text or credentials. */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateReport } from "../server/investigate.js";
import type { Investigation } from "../shared/schema.js";
const ids = process.argv.slice(2);
const metadata = JSON.parse(
  await readFile("data/source-metadata.json", "utf8"),
).sources;
if (!ids.length) throw Error("Pass reviewed investigation IDs explicitly.");
await mkdir("data/investigations", { recursive: true });
for (const id of ids) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id))
    throw Error("Invalid run identifier.");
  const raw = await readFile(`.runtime/investigations/${id}.json`, "utf8");
  const run = JSON.parse(raw) as Investigation;
  validateReport(run, run.sources);
  const sources = run.sources.map(({ fullText, excerpt, ...source }) => {
    if (metadata[source.id]) Object.assign(source, metadata[source.id]);
    if (source.id.startsWith("web-")) {
      source.summary =
        "Discovered during this Astra investigation. The linked original document supports the cited findings; scraped body text is not redistributed.";
      if (!metadata[source.id]) source.publishedAt = null;
    }
    const host = new URL(source.url).hostname;
    if (
      /(^|\.)(scholarrock\.com|capricor\.com|praxismedicines\.com|polypid\.com|ultragenyx\.com|telixpharma\.com|savarapharma\.com|summittxinc\.com|nuvalent\.com|gsk\.com)$/.test(
        host,
      )
    )
      source.kind = "sponsor";
    if (source.id.startsWith("crl-")) {
      const date = source.title.match(/\d{2}\/\d{2}\/\d{4}/)?.[0];
      if (date) {
        const url = new URL(source.url);
        const search = url.searchParams.get("search") || "";
        if (!search.includes("letter_date:"))
          url.searchParams.set("search", search + ` AND letter_date:"${date}"`);
        source.url = url.href;
      }
    }
    return {
      ...source,
      ...(excerpt && excerpt.split(/\s+/).length <= 25 ? { excerpt } : {}),
    };
  });
  const exported = {
    ...run,
    provenance: "recorded",
    sources,
    recording: {
      exportedAt: new Date().toISOString(),
      originalSha256: createHash("sha256").update(raw).digest("hex"),
      metadataChanges:
        "Removed raw source bodies and copied search snippets; classified known sponsor domains; applied independently reviewed publication metadata from data/source-metadata.json; unverified search-result publication dates are withheld; narrowed legacy CRL search links by letter date. Model findings, outlook, question, tool trace, token usage and timing are unchanged.",
    },
  };
  await writeFile(
    `data/investigations/${id}.json`,
    JSON.stringify(exported, null, 2) + "\n",
  );
  console.log(`Recorded reviewed Astra run ${id}`);
}
