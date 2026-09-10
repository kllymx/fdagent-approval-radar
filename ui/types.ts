export type Direction = 'supportive' | 'concern' | 'unknown' | 'neutral';

export interface Source {
  id: string;
  title: string;
  url: string;
  publisher: string;
  publishedAt: string | null;
  retrievedAt: string;
  kind: 'fda' | 'sec' | 'sponsor' | 'trial' | 'publication';
  summary: string;
  excerpt?: string;
}

export interface Candidate {
  id: string;
  drug: string;
  indication: string;
  sponsor: string;
  ticker?: string;
  modality: string;
  phase: string;
  reviewType: string;
  applicationType: string;
  applicationNumber?: string;
  nctIds: string[];
  status: 'under_review' | 'approved' | 'complete_response' | 'development';
  targetDate: string | null;
  targetDateKind: 'reported' | 'unknown';
  asOf: string;
  summary: string;
  sourceIds: string[];
  milestones: { id: string; date: string; title: string; detail: string; kind: string; sourceIds: string[] }[];
  signals: { id: string; label: string; detail: string; direction: Direction; category: string; sourceIds: string[] }[];
}

export interface Dataset {
  schemaVersion: number;
  generatedAt: string;
  asOf: string;
  candidates: Candidate[];
  sources: Source[];
  coverage: { title: string; description: string; limitations: string[] };
}

export interface RuntimeInfo {
  configured: boolean;
  model: string;
  provider: string;
  status: 'ready' | 'unconfigured' | 'error';
  message?: string;
  fdagent?: boolean;
}

export interface ModelSummary {
  status: 'evaluated' | 'exploratory' | 'unavailable';
  title: string;
  summary: string;
  cohortSize: number;
  metrics: { label: string; value: string; detail?: string }[];
  limitations: string[];
  series?: { label: string; points: { month: number; probability: number }[] }[];
  updatedAt?: string;
  generatedAt?: string;
  cohortSizeUnit?: string;
  sources?: { id: string; title: string; url: string }[];
  approvalRatePrior?: {
    method: string;
    train: { receiptFiscalYears: number[]; cells: number; availableBy: string };
    test: { receiptFiscalYears: number[]; cells: number; forecastCutoff: string };
    evaluation: Record<string, { maePercentagePoints: number }>;
    heldOutPredictions: { receiptFiscalYear: number; reviewClass: string; firstCycleApprovalPercent: number; prediction: number; pooledPrediction: number }[];
    current: Record<string, { meanRate: number; annualCohortCount: number; annualObservedRange: number[]; candidateProbability: null }>;
  };
  actionTiming?: {
    test: { dueOrResolved: number; pendingWithinGoal: number; forecastCutoff: string };
    evaluation: Record<string, { brier: number; observedOnTimeRate: number; meanPrediction: number }>;
  };
  reviewHistories?: {
    histories?: ReviewHistory[];
    cases?: ReviewHistory[];
    records?: ReviewHistory[];
    [key: string]: unknown;
  };
}

export interface ReviewHistory {
  id: string;
  drug: string;
  genericName: string;
  reviewClass: string;
  totalMonths: number;
  timeline: { stage: string; months: number; outcome: string | null; cumulativeMonths: number; majorAmendmentMarker: boolean }[];
  sourceUrl: string;
  lesson: string;
  selection: string;
}

export interface Finding {
  id: string;
  title: string;
  detail: string;
  direction: Direction;
  sourceIds: string[];
}

export interface Investigation {
  id: string;
  candidateId: string;
  model: string;
  createdAt: string;
  mode: 'investigate' | 'challenge';
  question: string;
  status: 'completed' | 'failed';
  provenance: 'live' | 'recorded';
  summary: string;
  outlook: { verdict: string; timing: string; probability: number | null; probabilityBasis: string };
  findings: Finding[];
  analogs: { title: string; relevance: string; difference: string; sourceIds: string[] }[];
  nextEvidence: string[];
  limitations: string[];
  sources: Source[];
  usage?: { inputTokens: number; outputTokens: number };
  durationMs?: number;
  evidenceAssessment?: AssessmentContent;
  tools?: { name: string; arguments: Record<string, unknown>; status: 'completed' | 'partial' | 'error'; durationMs: number }[];
  previousRunId?: string;
  previousOutlook?: { verdict: string; timing: string };
  decisionBrief?: {
    pivotalQuestion: string;
    bullCase: { claim: string; sourceIds: string[] };
    bearCase: { claim: string; sourceIds: string[] };
    decisiveEvidence: { question: string; whyItMatters: string; sourceIds: string[] };
    scenarios: { label: string; trigger: string; implication: string; sourceIds: string[] }[];
    diligenceQuestions: { question: string; whyItMatters: string; sourceIds: string[] }[];
  };
  changes?: {
    disposition: 'revised' | 'strengthened' | 'unchanged' | 'mixed';
    summary: string;
    items: { previousClaim: string; currentClaim: string; reason: string; sourceIds: string[] }[];
  } | null;
}

export interface AssessmentContent {
  category: 'favorable' | 'mixed' | 'concerning' | 'insufficient';
  summary: string;
  pivotalQuestion: string;
  sourceIds: string[];
  factors: {
    category: 'clinical' | 'safety' | 'manufacturing' | 'regulatory';
    state: 'supportive' | 'mixed' | 'concern' | 'unknown';
    rationale: string;
    sourceIds: string[];
  }[];
}

export interface Assessment extends AssessmentContent {
  candidateId: string;
  model: string;
  createdAt: string;
  evidenceAsOf: string;
  scope: 'initial_packet' | 'investigation';
  basedOnRunId: string | null;
  inputHash: string;
  responseId: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface InvestigationSummary {
  id: string;
  candidateId: string;
  model: string;
  createdAt: string;
  mode: 'investigate' | 'challenge';
  provenance: 'live' | 'recorded';
  summary?: string;
}

export interface Dashboard {
  catalog: Dataset;
  model: ModelSummary;
  runtime: RuntimeInfo;
  investigations: InvestigationSummary[];
  evidenceCandidateIds?: string[];
  evidenceSourcesByCandidate?: Record<string, Source[]>;
  assessments?: Record<string, Assessment>;
}

export interface EvidenceDossier {
  candidateId: string;
  generatedAt: string;
  provenance: 'live' | 'recorded';
  families: {
    id: 'trials' | 'approvals' | 'labels' | 'publications' | 'fdagent';
    label: string;
    status: 'ready' | 'empty' | 'error' | 'not_checked';
    total: number | null;
    returned: number;
    sourceIds: string[];
    coverage: string;
    error?: string;
    records: { id: string; sourceId: string; title: string; url: string; summary: string; fields: Record<string, unknown> }[];
  }[];
  sources: Source[];
}

export type StreamEvent =
  | { type: 'started'; runId: string; model: string }
  | { type: 'progress'; stage: string; message: string }
  | { type: 'finding'; finding: Finding }
  | { type: 'complete'; investigation: Investigation }
  | { type: 'error'; message: string };
