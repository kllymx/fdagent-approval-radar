import { z } from "zod";
export const direction = z.enum([
  "supportive",
  "concern",
  "unknown",
  "neutral",
]);
export const sourceSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    url: z.string().url(),
    publisher: z.string(),
    publishedAt: z.string().nullable(),
    retrievedAt: z.string(),
    kind: z.enum(["fda", "sec", "sponsor", "trial", "publication"]),
    summary: z.string(),
    excerpt: z.string().optional(),
    fullText: z.string().optional(),
  })
  .passthrough();
export const candidateSchema = z
  .object({
    id: z.string(),
    drug: z.string(),
    indication: z.string(),
    sponsor: z.string(),
    ticker: z.string().optional(),
    modality: z.string(),
    phase: z.string(),
    reviewType: z.string(),
    applicationType: z.string(),
    applicationNumber: z.string().optional(),
    nctIds: z.array(z.string()),
    status: z.enum([
      "under_review",
      "approved",
      "complete_response",
      "development",
    ]),
    targetDate: z.string().nullable(),
    targetDateKind: z.enum(["reported", "unknown"]),
    asOf: z.string(),
    summary: z.string(),
    sourceIds: z.array(z.string()),
    milestones: z.array(
      z.object({
        id: z.string(),
        date: z.string(),
        title: z.string(),
        detail: z.string(),
        kind: z.enum([
          "trial",
          "submission",
          "acceptance",
          "target",
          "extension",
          "approval",
          "crl",
          "update",
        ]),
        sourceIds: z.array(z.string()),
      }),
    ),
    signals: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        detail: z.string(),
        direction,
        category: z.enum([
          "clinical",
          "safety",
          "manufacturing",
          "regulatory",
          "timing",
        ]),
        sourceIds: z.array(z.string()),
      }),
    ),
  })
  .passthrough();
export const catalogSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  asOf: z.string(),
  candidates: z.array(candidateSchema),
  sources: z.array(sourceSchema),
  coverage: z.object({
    title: z.string(),
    description: z.string(),
    limitations: z.array(z.string()),
  }),
});
export const reportSchema = z.object({
  summary: z.string(),
  outlook: z.object({
    verdict: z.string(),
    timing: z.string(),
    probability: z.number().min(0).max(1).nullable(),
    probabilityBasis: z.string(),
  }),
  findings: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        detail: z.string(),
        direction,
        sourceIds: z.array(z.string()),
      }),
    )
    .min(1)
    .max(12),
  analogs: z
    .array(
      z.object({
        title: z.string(),
        relevance: z.string(),
        difference: z.string(),
        sourceIds: z.array(z.string()),
      }),
    )
    .max(5),
  nextEvidence: z.array(z.string()).max(8),
  limitations: z.array(z.string()).max(12),
});
export type Source = z.infer<typeof sourceSchema>;
export type Candidate = z.infer<typeof candidateSchema>;
export type Catalog = z.infer<typeof catalogSchema>;
export type Report = z.infer<typeof reportSchema>;
export type Investigation = Report & {
  id: string;
  candidateId: string;
  model: string;
  createdAt: string;
  mode: string;
  question: string;
  status: "completed" | "failed";
  provenance: "live" | "recorded";
  sources: Source[];
  usage?: { inputTokens: number; outputTokens: number };
  durationMs?: number;
  tools?: {
    name: string;
    arguments: Record<string, unknown>;
    status: string;
    durationMs: number;
  }[];
  validation?: {
    citationIdsValid: boolean;
    probabilityWithheld: boolean;
    warning: string[];
  };
};
export type ModelSummary = {
  status: "evaluated" | "exploratory" | "unavailable";
  title: string;
  summary: string;
  cohortSize: number;
  metrics: { label: string; value: string; detail?: string }[];
  limitations: string[];
  series?: {
    label: string;
    points: { month: number; probability: number }[];
  }[];
  updatedAt?: string;
  [key: string]: unknown;
};
