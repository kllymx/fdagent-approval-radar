import {
  mkdir,
  readFile,
  readdir,
  rename,
  writeFile,
  rm,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import type { Candidate, Source } from "../shared/schema.js";
import { executeEvidenceQuery, type EvidenceFamily } from "./evidence.js";
import { fdagentConfigured, queryFDAgent } from "./fdagent.js";

export type EvidenceRecord = {
  id: string;
  sourceId: string;
  title: string;
  url: string;
  summary: string;
  fields: Record<string, unknown>;
};
export type EvidenceDossier = {
  candidateId: string;
  generatedAt: string;
  provenance: "live" | "recorded";
  families: {
    id: EvidenceFamily | "fdagent";
    label: string;
    status: "ready" | "empty" | "error" | "not_checked";
    total: number | null;
    returned: number;
    sourceIds: string[];
    coverage: string;
    error?: string;
    records: EvidenceRecord[];
  }[];
  sources: Source[];
};
const labels: Record<EvidenceFamily, string> = {
  trials: "ClinicalTrials.gov",
  approvals: "Drugs@FDA",
  labels: "Drug labeling",
  publications: "PubMed",
};
function safeId(id: string) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id))
    throw Error("Invalid candidate identifier.");
  return id;
}
export async function readDossier(
  id: string,
  recordedOnly = false,
): Promise<EvidenceDossier | null> {
  safeId(id);
  for (const dir of recordedOnly
    ? ["data/evidence"]
    : [".cache/evidence", "data/evidence"]) {
    try {
      const dossier = JSON.parse(
        await readFile(resolve(dir, `${id}.json`), "utf8"),
      );
      return {
        ...dossier,
        sources: dossier.sources.map((source: Source) =>
          source.id.startsWith("evidence-")
            ? { ...source, contentKind: "metadata" }
            : source,
        ),
        provenance: dir.startsWith("data/") ? "recorded" : "live",
      };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }
  return null;
}
export async function listDossiers(recordedOnly = false) {
  const ids = new Set<string>();
  for (const dir of recordedOnly
    ? ["data/evidence"]
    : [".cache/evidence", "data/evidence"]) {
    try {
      for (const name of await readdir(dir))
        if (/^[a-zA-Z0-9_-]+\.json$/.test(name)) ids.add(name.slice(0, -5));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }
  return [...ids];
}
type SharedScan = {
  controller: AbortController;
  observers: Map<symbol, ((message: string) => void) | undefined>;
  settled: boolean;
  promise?: Promise<EvidenceDossier>;
};
const pending = new Map<string, SharedScan>();
function joinScan(
  scan: SharedScan,
  onProgress?: (message: string) => void,
  signal?: AbortSignal,
): Promise<EvidenceDossier> {
  signal?.throwIfAborted();
  const id = Symbol("scan subscriber");
  scan.observers.set(id, onProgress);
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort);
      scan.observers.delete(id);
    };
    const onAbort = () => {
      cleanup();
      // One cancelled investigation must not cancel a scan another caller needs.
      if (!scan.observers.size && !scan.settled) scan.controller.abort();
      reject(
        signal?.reason ??
          new DOMException("Evidence scan cancelled.", "AbortError"),
      );
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    scan.promise!.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error) => {
        cleanup();
        reject(error);
      },
    );
    if (signal?.aborted) onAbort();
  });
}
export async function gatherDossier(
  candidate: Candidate,
  onProgress?: (message: string) => void,
  options: { refresh?: boolean; signal?: AbortSignal } = {},
): Promise<EvidenceDossier> {
  options.signal?.throwIfAborted();
  safeId(candidate.id);
  const cached = await readDossier(candidate.id);
  options.signal?.throwIfAborted();
  if (
    !options.refresh &&
    cached?.provenance === "live" &&
    Date.now() - Date.parse(cached.generatedAt) < 30 * 60_000
  ) {
    onProgress?.(
      "Using the public-source scan retrieved within the last 30 minutes; original retrieval times are retained.",
    );
    return cached;
  }
  const existing = pending.get(candidate.id);
  if (existing) {
    onProgress?.(
      "Joining the public-source scan already running for this candidate.",
    );
    return joinScan(existing, onProgress, options.signal);
  }
  if (pending.size >= 2)
    throw Error(
      "Two evidence scans are already running; try again when one completes.",
    );
  const scan: SharedScan = {
    controller: new AbortController(),
    observers: new Map(),
    settled: false,
  };
  pending.set(candidate.id, scan);
  scan.promise = Promise.resolve()
    .then(() =>
      gather(
        candidate,
        (message) => {
          for (const callback of scan.observers.values()) {
            try {
              callback?.(message);
            } catch {
              /* A disconnected observer must not cancel other subscribers. */
            }
          }
        },
        scan.controller.signal,
      ),
    )
    .finally(() => {
      scan.settled = true;
      if (pending.get(candidate.id) === scan) pending.delete(candidate.id);
    });
  return joinScan(scan, onProgress, options.signal);
}
async function gather(
  candidate: Candidate,
  onProgress?: (message: string) => void,
  signal?: AbortSignal,
): Promise<EvidenceDossier> {
  signal?.throwIfAborted();
  const sources = new Map<string, Source>();
  const families: EvidenceDossier["families"] = [];
  // Names are discovery queries. Matching products/indications is left explicit for review.
  const drug = candidate.drug
    .split("(")[0]
    .split(" + ")[0]
    .trim()
    .replace(/\s+inhalation solution$/i, "");
  await Promise.all(
    (Object.keys(labels) as EvidenceFamily[]).map(async (family) => {
      signal?.throwIfAborted();
      onProgress?.(`Checking ${labels[family]} for ${drug}.`);
      try {
        const result = await executeEvidenceQuery(
          family,
          {
            drug,
            applicationNumber: candidate.applicationNumber,
            ...(family === "trials" && candidate.nctIds.length
              ? { nctIds: candidate.nctIds.slice(0, 8) }
              : {}),
            limit: 5,
          },
          { signal },
        );
        for (const source of result.sources) sources.set(source.id, source);
        families.push({
          id: family,
          label: labels[family],
          status: result.records.length ? "ready" : "empty",
          total: result.total,
          returned: result.records.length,
          sourceIds: result.sources.map((s) => s.id),
          coverage: result.coverage + " " + result.limitations.join(" "),
          records: result.records,
        });
        onProgress?.(
          `${labels[family]} returned ${result.records.length} research records.`,
        );
      } catch (e) {
        signal?.throwIfAborted();
        families.push({
          id: family,
          label: labels[family],
          status: "error",
          total: null,
          returned: 0,
          sourceIds: [],
          coverage:
            "Source unavailable. No conclusion about missing evidence follows from this failure.",
          error: (e as Error).message.slice(0, 250),
          records: [],
        });
        onProgress?.(
          `${labels[family]} is unavailable; the evidence gap is retained.`,
        );
      }
    }),
  );
  signal?.throwIfAborted();
  if (fdagentConfigured()) {
    onProgress?.(
      "Checking the existing FDAgent inspection dataset for sponsor-name matches.",
    );
    try {
      const result = await queryFDAgent(
        "inspections",
        candidate.sponsor.split(" / ")[0],
        { signal },
      );
      for (const source of result.sources) sources.set(source.id, source);
      const rows = Array.isArray(result.records) ? result.records : [];
      families.push({
        id: "fdagent",
        label: "FDAgent compliance",
        status: rows.length ? "ready" : "empty",
        total: null,
        returned: rows.length,
        sourceIds: result.sources.map((s) => s.id),
        coverage:
          result.coverage +
          (result.citationGap ? " " + result.citationGap : ""),
        records: rows.map((row: Record<string, unknown>, index) => ({
          id: "compliance-" + index,
          sourceId: "",
          title: String(row.firmName || "FDA inspection lead"),
          url: "",
          summary: `Inspection ${row.inspectionEndDate || "date unknown"}; classification ${row.classification || "unknown"}; FEI ${row.fei || "unknown"}. Candidate relationship not established.`,
          fields: row,
        })),
      });
    } catch {
      signal?.throwIfAborted();
      families.push({
        id: "fdagent",
        label: "FDAgent compliance",
        status: "error",
        total: null,
        returned: 0,
        sourceIds: [],
        coverage:
          "FDAgent connector unavailable. No conclusion about compliance follows.",
        records: [],
      });
    }
  } else
    families.push({
      id: "fdagent",
      label: "FDAgent compliance",
      status: "not_checked",
      total: null,
      returned: 0,
      sourceIds: [],
      coverage:
        "Connect the existing FDAgent MCP server locally to inspect regulatory history.",
      records: [],
    });
  families.sort(
    (a, b) =>
      [...Object.keys(labels), "fdagent"].indexOf(a.id) -
      [...Object.keys(labels), "fdagent"].indexOf(b.id),
  );
  const dossier: EvidenceDossier = {
    candidateId: candidate.id,
    generatedAt: new Date().toISOString(),
    provenance: "live",
    families,
    sources: [...sources.values()],
  };
  const dir = resolve(".cache/evidence");
  signal?.throwIfAborted();
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const path = resolve(dir, `${candidate.id}.json`);
  const temp = path + "." + randomUUID() + ".tmp";
  try {
    await writeFile(temp, JSON.stringify(dossier), { mode: 0o600, signal });
    signal?.throwIfAborted();
    await rename(temp, path);
  } finally {
    await rm(temp, { force: true });
  }
  return dossier;
}
export function publicDossier(dossier: EvidenceDossier): EvidenceDossier {
  return {
    ...dossier,
    sources: dossier.sources.map(({ fullText, excerpt, ...source }) => source),
  };
}
