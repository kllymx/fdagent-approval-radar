# Approval Radar implementation contract

## Product

A public-data intelligence and forecasting workbench for drug–indication FDA review episodes. User selects a real candidate; sees a verified evidence timeline and reported target date; can ask Astra to investigate, compare historical analogs, challenge an assumption and publish an evidence-linked outlook. Empirical models must be evaluated honestly and explicitly limited to their cohort. No uploads, private data, invented probability, or simulated Astra output.

## Initial runtime

TypeScript + React + Vite frontend in ui/. Root owns Vite/package/config. Node TypeScript server in server/ using native HTTP and OpenAI Responses API. A small Python stdlib analysis pipeline is acceptable for reproducible research. Root wires generated JSON to the server/UI. Defaults: frontend 5178; backend 8788. Proxy /api to backend. Public source repository proposed kllymx/fdagent-approval-radar. Do not publish until root validates.

## Ownership

- Data agent: data/**, scripts/data/**. Real active candidates and dated source evidence, data contract JSON, refreshing and validators. Candidate extraction may be manual curated with attribution; do not label it Astra-generated unless actually called.
- Forecast agent: model/**, research/model/**. Independently construct defensible historical cohort, train/evaluate modest baselines, emit model artifacts and full limitations. Root will provide credentials if needed; meaningful research/data code can proceed without model API.
- Interface agent: ui/** only. Root provides API/types below and installs dependencies.
- Root: server/**, shared/**, package.json/lock, root scripts, README/docs, tests/integration, Git/publication.

## Shared JSON shape (camelCase)

Source: { id, title, url, publisher, publishedAt: ISO date | null, retrievedAt: ISO datetime, kind: 'fda'|'sec'|'sponsor'|'trial'|'publication', summary: string, excerpt?: string, fullText?: string }.
Public data stores minimal excerpts from nongovernment publishers (<=25 words per page) and summaries/links. Full text may live in ignored .cache only. Government source text may be retained with provenance.

Candidate: { id, drug, indication, sponsor, ticker?: string, modality: string, phase: string, reviewType: string, applicationType: string, applicationNumber?: string, nctIds: string[], status: 'under_review'|'approved'|'complete_response'|'development', targetDate: string|null, targetDateKind: 'reported'|'unknown', asOf: string, summary: string, sourceIds: string[], milestones: Milestone[], signals: Signal[] }.

Milestone: { id, date: string, title, detail, kind: 'trial'|'submission'|'acceptance'|'target'|'extension'|'approval'|'crl'|'update', sourceIds: string[] }.
Signal: { id, label, detail, direction: 'supportive'|'concern'|'unknown'|'neutral', category: 'clinical'|'safety'|'manufacturing'|'regulatory'|'timing', sourceIds: string[] }.

Dataset data/catalog.json: { schemaVersion: 1, generatedAt, asOf, candidates: Candidate[], sources: Source[], coverage: { title, description, limitations: string[] } }.

Model artifacts may choose their detailed schema; send root a sample early. Desired fields: cohort definition, sample counts, selection/censoring/leakage limitations, train/test split dates and counts, observed metrics, methods and any fitted parameters. Never invent enough data to fill this contract. Root adapters will supply UI summary.

## API

GET /api/dashboard returns { catalog: Dataset, model: ModelSummary, runtime: RuntimeInfo, investigations: InvestigationSummary[] }.
RuntimeInfo: { configured: boolean, model: string, provider: string, status: 'ready'|'unconfigured'|'error', message?: string }.
ModelSummary: { status: 'evaluated'|'exploratory'|'unavailable', title, summary, cohortSize: number, metrics: { label, value: string, detail?: string }[], limitations: string[], series?: { label, points: {month:number, probability:number}[] }[], updatedAt?: string }.

POST /api/investigate body { candidateId: string, question?: string, mode?: 'investigate'|'challenge', previousRunId?: string } responds NDJSON events. Events {type:'started',runId,model}, {type:'progress',stage,message}, {type:'finding',finding}, {type:'complete',investigation}, {type:'error',message}. Progress reflects actual stages/tool calls, never pretend elapsed activity. UI must handle JSON error response as well.
GET /api/investigations/:runId returns Investigation.

Investigation: { id, candidateId, model, createdAt, mode, question, status:'completed'|'failed', provenance:'live'|'recorded', summary, outlook: { verdict: string, timing: string, probability: number|null, probabilityBasis: string }, findings: { id, title, detail, direction:'supportive'|'concern'|'unknown'|'neutral', sourceIds:string[] }[], analogs: { title, relevance, difference, sourceIds:string[] }[], nextEvidence: string[], limitations: string[], sources: Source[], usage?: {inputTokens:number, outputTokens:number}, durationMs?:number }.

GET /api/candidates/:id returns {candidate, sources, investigations}. Frontend can use dashboard for initial selection. Historical real stored research output is welcome but always labeled recorded; unknown API shape handled visibly.

## Interface priorities

An attractive dense desktop workbench: left sortable/filterable candidate list, center selected candidate evidence/timeline and source-linked Astra investigation; optional methodology/evaluation view or tab. Primary CTA 'Investigate with Astra'; challenge input. Distinguish reported target, experimental model, actual source evidence and Astra interpretation. Responsive design. No made-up probabilities or quote/prediction claims. Show useful sourced data immediately without API key. Empty/error/running states work.
