import { getCatalog } from "../server/data.js";
const catalog = await getCatalog();
if (!catalog.candidates.length)
  throw Error("The catalog contains no real candidates.");
const sourceIds = new Set(catalog.sources.map((s) => s.id));
if (sourceIds.size !== catalog.sources.length)
  throw Error("Duplicate source IDs.");
if (
  new Set(catalog.candidates.map((c) => c.id)).size !==
  catalog.candidates.length
)
  throw Error("Duplicate candidate IDs.");
for (const c of catalog.candidates) {
  for (const id of [
    ...c.sourceIds,
    ...c.signals.flatMap((s) => s.sourceIds),
    ...c.milestones.flatMap((m) => m.sourceIds),
  ])
    if (!sourceIds.has(id)) throw Error(`${c.id}: missing source ${id}`);
  if (c.targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(c.targetDate))
    throw Error(`${c.id}: malformed target date`);
}
for (const s of catalog.sources) {
  if (new URL(s.url).protocol !== "https:")
    throw Error(`Non-HTTPS source ${s.id}`);
  if (
    s.kind !== "fda" &&
    s.kind !== "sec" &&
    s.excerpt &&
    s.excerpt.split(/\s+/).length > 25
  )
    throw Error(`Publisher excerpt >25 words: ${s.id}`);
}
console.log(
  `Validated ${catalog.candidates.length} candidates and ${catalog.sources.length} public sources.`,
);
