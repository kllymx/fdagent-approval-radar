import { ArrowRight, ChevronDown, ChevronRight, GitCompareArrows, ListChecks, SearchCheck } from 'lucide-react';
import type { Investigation } from './types';

function EvidenceLink({ ids, onOpen }: { ids: string[]; onOpen: (ids: string[]) => void }) {
  const sourceIds = [...new Set(ids)];
  if (!sourceIds.length) return null;
  return <button className="intelligence-sources" onClick={() => onOpen(sourceIds)}>{sourceIds.length} {sourceIds.length === 1 ? 'source' : 'sources'}<ChevronRight size={11} /></button>;
}

export function DecisionBrief({ brief, onOpenSources }: { brief: NonNullable<Investigation['decisionBrief']>; onOpenSources: (ids: string[]) => void }) {
  return <section className="decision-brief">
    <div className="pivotal-question"><SearchCheck size={19} /><div><span>The pivotal question</span><h2>{brief.pivotalQuestion}</h2></div></div>
    <div className="opposing-cases"><article className="bull-case"><h3>Case for approval</h3><p>{brief.bullCase.claim}</p><EvidenceLink ids={brief.bullCase.sourceIds} onOpen={onOpenSources} /></article><article className="bear-case"><h3>Case for a setback</h3><p>{brief.bearCase.claim}</p><EvidenceLink ids={brief.bearCase.sourceIds} onOpen={onOpenSources} /></article></div>
    <div className="decisive-evidence"><h3>What would decide it</h3><p className="decisive-question">{brief.decisiveEvidence.question}</p><p>{brief.decisiveEvidence.whyItMatters}</p><EvidenceLink ids={brief.decisiveEvidence.sourceIds} onOpen={onOpenSources} /></div>
    {brief.scenarios.length > 0 && <details className="disclosure scenario-disclosure"><summary><span>Possible paths and their implications</span><ChevronDown size={14} /></summary><div className="scenario-list">{brief.scenarios.map((scenario, index) => <article key={`${index}-${scenario.label}`}><h3>{scenario.label}</h3><div><span>If</span><p>{scenario.trigger}</p></div><div><ArrowRight size={13} /><p>{scenario.implication}</p></div><EvidenceLink ids={scenario.sourceIds} onOpen={onOpenSources} /></article>)}</div></details>}
    {brief.diligenceQuestions.length > 0 && <details className="disclosure diligence-disclosure"><summary><ListChecks size={15} /><span>Questions for diligence</span><ChevronDown size={14} /></summary>{brief.diligenceQuestions.map((item, index) => <article className="diligence-question" key={`${index}-${item.question}`}><h3>{item.question}</h3><p>{item.whyItMatters}</p><EvidenceLink ids={item.sourceIds} onOpen={onOpenSources} /></article>)}</details>}
  </section>;
}

export function InvestigationChanges({ investigation, onOpenSources }: { investigation: Investigation; onOpenSources: (ids: string[]) => void }) {
  if (!investigation.changes) return null;
  const changes = investigation.changes;
  const disposition = { revised: 'Revised', strengthened: 'Strengthened', unchanged: 'Unchanged', mixed: 'Mixed revision' }[changes.disposition];
  return <section className="investigation-changes"><div className="changes-heading"><h2><GitCompareArrows size={16} />What changed</h2><span>{disposition}</span></div><p className="changes-summary">{changes.summary}</p>
    {changes.items.length > 0 && <details className="disclosure claim-changes"><summary><span>Compare {changes.items.length} {changes.items.length === 1 ? 'claim' : 'claims'} with the previous assessment</span><ChevronDown size={14} /></summary>{changes.items.map((item, index) => <article className="claim-change" key={`${index}-${item.currentClaim}`}><div className="claim-comparison"><div><span>Previous assessment</span><p>{item.previousClaim}</p></div><ArrowRight size={15} /><div><span>Updated assessment</span><p>{item.currentClaim}</p></div></div><p className="change-reason">{item.reason}</p><EvidenceLink ids={item.sourceIds} onOpen={onOpenSources} /></article>)}</details>}
    {investigation.previousOutlook && <details className="disclosure overall-comparison"><summary><span>Compare overall outlooks</span><ChevronDown size={14} /></summary><div className="claim-comparison"><div><span>Previous outlook</span><p>{investigation.previousOutlook.verdict}</p><p>{investigation.previousOutlook.timing}</p></div><ArrowRight size={15} /><div><span>Current outlook</span><p>{investigation.outlook.verdict}</p><p>{investigation.outlook.timing}</p></div></div></details>}
  </section>;
}
