import { useState } from 'react';
import { ArrowRight, BookOpen, Check, ChevronDown, ChevronRight, CircleHelp, Minus, TriangleAlert } from 'lucide-react';
import { candidateActionDate, formatDate } from './lib';
import { candidateOutlook, OUTLOOK_LABELS, type OutlookCategory } from './assessment';
import type { Assessment, AssessmentContent, Candidate } from './types';

const factorLabels: Record<AssessmentContent['factors'][number]['category'], string> = { clinical: 'Clinical evidence', safety: 'Safety', manufacturing: 'Manufacturing', regulatory: 'Regulatory' };
const stateLabels = { supportive: 'Supportive', mixed: 'Mixed', concern: 'Concern', unknown: 'Unknown' };
const factorOrder = ['clinical', 'safety', 'manufacturing', 'regulatory'] as const;

export function OutlookBadge({ category, compact = false }: { category: OutlookCategory; compact?: boolean }) {
  return <span className={`outlook-badge outlook-${category} ${compact ? 'compact' : ''}`} title={OUTLOOK_LABELS[category]}><span className="outlook-dot" aria-hidden="true" />{compact ? <span className="sr-only">{OUTLOOK_LABELS[category]}</span> : OUTLOOK_LABELS[category]}</span>;
}

function StateIcon({ state }: { state: AssessmentContent['factors'][number]['state'] }) {
  return state === 'supportive' ? <Check size={13} /> : state === 'concern' ? <TriangleAlert size={13} /> : state === 'mixed' ? <Minus size={13} /> : <CircleHelp size={13} />;
}

export default function AssessmentView({ candidate, assessment, onSources, onInvestigation }: { candidate: Candidate; assessment?: Assessment; onSources: (ids: string[]) => void; onInvestigation: () => void }) {
  const [expandedFactor, setExpandedFactor] = useState<string | null>(null);
  const category = candidateOutlook(candidate, assessment);
  const action = candidateActionDate(candidate);
  if (action.completed) return <section className="candidate-assessment completed-assessment" aria-label="Observed FDA action"><div className="assessment-heading"><h2>FDA review outcome</h2><span className="assessment-scope">Observed action</span></div><h3 className={`assessment-verdict outlook-${category}`}><span className="outlook-dot" aria-hidden="true" />{OUTLOOK_LABELS[category]}</h3><p className="completed-action-date">{action.date ? `${action.label} on ${formatDate(action.date)}.` : 'The action date is not recorded in the available evidence.'}</p><button className="primary-button assessment-primary" onClick={onInvestigation}>Explore Astra’s reasoning<ArrowRight size={14} /></button></section>;
  if (!assessment) return <section className="candidate-assessment unassessed"><div><OutlookBadge category="not_assessed" /><p>No Astra assessment is available for this candidate.</p></div><button className="text-button" onClick={onInvestigation}>Open research<ArrowRight size={13} /></button></section>;
  const selectedFactor = assessment.factors.find((factor) => factor.category === expandedFactor);
  const scopeLabel = assessment.scope === 'investigation' ? 'Investigated' : 'Initial assessment';
  const headline = { favorable: 'Favorable case', mixed: 'Mixed case', concerning: 'Material concerns', insufficient: 'Evidence incomplete' }[assessment.category];
  return <section className={`candidate-assessment assessment-${category}`} aria-label="Astra evidence assessment">
    <div className="assessment-heading"><h2>Astra approval outlook</h2><span className="assessment-scope">{scopeLabel}</span></div>
    <h3 className={`assessment-verdict outlook-${category}`}><span className="outlook-dot" aria-hidden="true" />{headline}</h3>
    <p className="assessment-summary">{assessment.summary}</p>
    <p className="assessment-crux"><span>Key diligence question</span>{assessment.pivotalQuestion}</p>
    <button className="primary-button assessment-primary" onClick={onInvestigation}>Explore Astra’s reasoning<ArrowRight size={14} /></button>
    <div className="assessment-factors" aria-label="Evidence factors">{factorOrder.map((key) => {
      const factor = assessment.factors.find((item) => item.category === key);
      const state = factor?.state ?? 'unknown';
      return <button key={key} className={`assessment-factor factor-${state} ${expandedFactor === key ? 'expanded' : ''}`} aria-expanded={expandedFactor === key} aria-controls={`factor-detail-${candidate.id}`} onClick={() => setExpandedFactor(expandedFactor === key ? null : key)}><span>{factorLabels[key]}</span><strong><StateIcon state={state} />{stateLabels[state]}<ChevronDown size={12} /></strong><i aria-hidden="true" /></button>;
    })}</div>
    {expandedFactor && <div className="assessment-factor-detail" id={`factor-detail-${candidate.id}`}><strong>{factorLabels[expandedFactor as keyof typeof factorLabels]}</strong><p>{selectedFactor?.rationale ?? 'This factor was not assessed in the available source packet.'}</p>{selectedFactor?.sourceIds.length ? <button className="text-button" onClick={() => onSources(selectedFactor.sourceIds)}><BookOpen size={12} />{selectedFactor.sourceIds.length} sources<ChevronRight size={12} /></button> : null}</div>}
    <div className="assessment-footer"><details><summary>Assessment basis<ChevronDown size={12} /></summary><div><p>{assessment.scope === 'initial_packet' ? 'Astra interpreted the curated source summaries. This is an initial assessment; it is not a full investigation or a verification of the underlying studies.' : 'Astra assessed evidence from a completed investigation. The linked report contains its findings, source checks and limitations.'}</p><dl><div><dt>Model</dt><dd>{assessment.model}</dd></div><div><dt>Evidence as of</dt><dd>{formatDate(assessment.evidenceAsOf)}</dd></div><div><dt>Assessed</dt><dd>{formatDate(assessment.createdAt)}</dd></div></dl>{assessment.sourceIds.length > 0 && <button className="text-button" onClick={() => onSources(assessment.sourceIds)}><BookOpen size={12} />Inspect assessment sources<ChevronRight size={12} /></button>}</div></details><span>Qualitative outlook · No calibrated approval probability</span></div>
  </section>;
}
