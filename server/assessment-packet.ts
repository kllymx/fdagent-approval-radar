import { createHash } from "node:crypto";
import { ASSESSMENT_POLICY } from "../shared/assessment.js";
import type { Candidate, Catalog, Investigation } from "../shared/schema.js";

export function assessmentPacket(
  candidate: Candidate,
  catalog: Catalog,
  previous?: Investigation,
) {
  const ids = new Set([
    ...candidate.sourceIds,
    ...candidate.signals.flatMap((s) => s.sourceIds),
    ...candidate.milestones.flatMap((s) => s.sourceIds),
  ]);
  const sources = [
    ...new Map(
      [
        ...catalog.sources.filter((s) => ids.has(s.id)),
        ...(previous?.sources ?? []),
      ].map(({ fullText, excerpt, ...source }) => [source.id, source]),
    ).values(),
  ];
  const packet = {
    candidate,
    sources,
    evidenceAsOf: catalog.asOf,
    latestInvestigation: previous
      ? {
          id: previous.id,
          createdAt: previous.createdAt,
          summary: previous.summary,
          outlook: previous.outlook,
          findings: previous.findings,
          decisionBrief: previous.decisionBrief,
          limitations: previous.limitations,
        }
      : null,
  };
  return {
    packet,
    inputHash: createHash("sha256")
      .update(ASSESSMENT_POLICY + JSON.stringify(packet))
      .digest("hex"),
  };
}
