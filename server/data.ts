import { readFile, readdir, mkdir, writeFile, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { assessmentPacket } from "./assessment-packet.js";
import { validateAssessment, type Assessment } from "../shared/assessment.js";
import {
  catalogSchema,
  type Catalog,
  type Investigation,
  type ModelSummary,
} from "../shared/schema.js";

export async function getCatalog(): Promise<Catalog> {
  try {
    return catalogSchema.parse(
      JSON.parse(await readFile(resolve("data/catalog.json"), "utf8")),
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    return {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      asOf: new Date().toISOString().slice(0, 10),
      candidates: [],
      sources: [],
      coverage: {
        title: "Public evidence",
        description: "Candidate catalog is being assembled.",
        limitations: ["No candidate data has been loaded."],
      },
    };
  }
}
export async function getModel(): Promise<ModelSummary> {
  try {
    const model = JSON.parse(
      await readFile(resolve("model/artifact.json"), "utf8"),
    );
    try {
      model.reviewHistories = JSON.parse(
        await readFile(resolve("model/review_histories.json"), "utf8"),
      );
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    return model;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    return {
      status: "unavailable",
      title: "Historical review baseline",
      summary:
        "A reproducible FDA review-cohort model will appear here when its evaluation artifact is available.",
      cohortSize: 0,
      metrics: [],
      limitations: [
        "No validated individual approval probability is available.",
      ],
    };
  }
}
const validId = /^[a-zA-Z0-9_-]{1,100}$/;
export async function listInvestigations(): Promise<Investigation[]> {
  const all: Investigation[] = [];
  for (const dir of [".runtime/investigations", "data/investigations"]) {
    try {
      for (const name of (await readdir(resolve(dir))).filter((n) =>
        n.endsWith(".json"),
      )) {
        try {
          const r = JSON.parse(
            await readFile(resolve(dir, name), "utf8"),
          ) as Investigation;
          if (r.status === "completed" && r.id && r.candidateId)
            all.push({
              ...r,
              provenance: dir.startsWith("data/") ? "recorded" : r.provenance,
            });
        } catch {
          /* An interrupted or invalid artifact is not a completed investigation. */
        }
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }
  return [
    ...new Map(
      all
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((r) => [r.id, r]),
    ).values(),
  ];
}
export async function getInvestigation(id: string) {
  if (!validId.test(id)) return null;
  return (await listInvestigations()).find((r) => r.id === id) ?? null;
}
export async function saveInvestigation(run: Investigation) {
  if (!validId.test(run.id)) throw Error("Invalid investigation identifier.");
  const dir = resolve(".runtime/investigations");
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const file = resolve(dir, `${run.id}.json`),
    tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(run, null, 2) + "\n", { mode: 0o600 });
  await rename(tmp, file);
}

// Prefer a current investigation assessment over its initial packet interpretation.
export async function getAssessments(
  catalog: Catalog,
  runs: Investigation[],
): Promise<Record<string, Assessment>> {
  const result: Record<string, Assessment> = {};
  for (const candidate of catalog.candidates) {
    const candidateRuns = runs
      .filter((r) => r.candidateId === candidate.id && r.status === "completed")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const latestRun = candidateRuns[0];
    const { packet, inputHash } = assessmentPacket(
      candidate,
      catalog,
      latestRun,
    );
    const sourceIds = new Set(packet.sources.map((s) => s.id));
    try {
      const record = JSON.parse(
        await readFile(
          resolve("data/assessments", `${candidate.id}.json`),
          "utf8",
        ),
      ) as Assessment;
      if (
        record.candidateId !== candidate.id ||
        !record.model.startsWith("gpt-6-astra")
      )
        throw Error("Invalid assessment provenance.");
      // Never let an older snapshot masquerade as the current investigation's opinion.
      if (
        record.inputHash === inputHash &&
        record.evidenceAsOf >= candidate.asOf
      ) {
        validateAssessment(record, sourceIds);
        result[candidate.id] = record;
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    if (latestRun?.evidenceAssessment) {
      const assessment = validateAssessment(
        latestRun.evidenceAssessment,
        latestRun.sources.map((s) => s.id),
      );
      result[candidate.id] = {
        ...assessment,
        candidateId: candidate.id,
        model: latestRun.model,
        createdAt: latestRun.createdAt,
        evidenceAsOf: latestRun.createdAt.slice(0, 10),
        scope: "investigation",
        basedOnRunId: latestRun.id,
        inputHash: latestRun.assessmentProvenance?.inputHash ?? "",
        responseId: latestRun.assessmentProvenance?.responseId ?? "",
      };
    }
  }
  return result;
}

export async function getTrialVisuals(catalog: Catalog, runs: Investigation[]) {
  try {
    const value = JSON.parse(
      await readFile(resolve("data/trial-visuals.json"), "utf8"),
    );
    const { validateTrialVisuals } = await import("../shared/trial-visuals.js");
    return validateTrialVisuals(
      value,
      Object.fromEntries(
        catalog.candidates.map((candidate) => [
          candidate.id,
          new Set([
            ...candidate.sourceIds,
            ...candidate.signals.flatMap((s) => s.sourceIds),
            ...candidate.milestones.flatMap((m) => m.sourceIds),
            ...runs
              .filter((r) => r.candidateId === candidate.id)
              .flatMap((r) => r.sources.map((s) => s.id)),
          ]),
        ]),
      ),
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw e;
  }
}
