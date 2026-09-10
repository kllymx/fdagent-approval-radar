import { useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, ArrowUpDown, BookOpen, CalendarDays, ChevronDown, Search, X } from 'lucide-react';
import { candidateActionDate, formatDate } from './lib';
import type { Assessment, Candidate, Dashboard, Source } from './types';
import { candidateOutlook, OUTLOOK_LABELS, OUTLOOK_ORDER, outlookCounts, type OutlookCategory } from './assessment';
import { OutlookBadge } from './AssessmentView';
import ResearchMissions from './ResearchMissions';

const statusLabels: Record<Candidate['status'], string> = {
  under_review: 'Under review', approved: 'Approved', complete_response: 'Complete response', development: 'In development',
};

function candidateSourceIds(candidate: Candidate): string[] {
  return [...new Set([...candidate.sourceIds, ...candidate.milestones.flatMap((milestone) => milestone.sourceIds), ...candidate.signals.flatMap((signal) => signal.sourceIds)])];
}

export function filterCandidates(candidates: Candidate[], filters: { query: string; status: string; month: string; sponsor: string; outlook?: OutlookCategory | '' }, assessments: Record<string, Assessment> = {}): Candidate[] {
  const query = filters.query.trim().toLowerCase();
  return candidates.filter((candidate) =>
    (!query || `${candidate.drug} ${candidate.indication} ${candidate.sponsor} ${candidate.ticker ?? ''} ${candidate.nctIds.join(' ')}`.toLowerCase().includes(query)) &&
    (!filters.status || candidate.status === filters.status) &&
    (!filters.outlook || candidateOutlook(candidate, assessments[candidate.id]) === filters.outlook) &&
    (!filters.month || (filters.month === 'unknown' ? !candidateActionDate(candidate).date : candidateActionDate(candidate).date?.startsWith(filters.month))) &&
    (!filters.sponsor || candidate.sponsor === filters.sponsor),
  );
}

export default function CandidateOverview({ dashboard, onSelect, onResume, selectedCandidate, renderLogo, onSources, extraSources }: {
  dashboard: Dashboard;
  onSelect: (id: string, analysis?: boolean, runId?: string) => void;
  onResume: () => void;
  selectedCandidate?: Candidate;
  renderLogo: (candidate: Candidate) => ReactNode;
  onSources: (ids: string[]) => void;
  extraSources: Record<string, Source[]>;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [month, setMonth] = useState('');
  const [sponsor, setSponsor] = useState('');
  const [sort, setSort] = useState('date');
  const [outlook, setOutlook] = useState<OutlookCategory | ''>('');
  const candidates = dashboard.catalog.candidates;
  const sources = useMemo(() => new Map([...dashboard.catalog.sources, ...Object.values(extraSources).flat()].map((source) => [source.id, source])), [dashboard.catalog.sources, extraSources]);
  const sourceIds = (candidate: Candidate) => [...new Set([...candidateSourceIds(candidate), ...(extraSources[candidate.id] ?? []).map((source) => source.id)])];
  const sponsorOptions = useMemo(() => [...new Set(candidates.map((candidate) => candidate.sponsor))].sort(), [candidates]);
  const months = useMemo(() => [...new Set(candidates.flatMap((candidate) => { const date = candidateActionDate(candidate).date; return date ? [date.slice(0, 7)] : []; }))].sort(), [candidates]);
  const filtered = useMemo(() => filterCandidates(candidates, { query, status, month, sponsor, outlook }, dashboard.assessments).sort((a, b) => {
    if (sort === 'outlook') {
      const order: OutlookCategory[] = ['concerning', 'mixed', 'insufficient', 'not_assessed', 'favorable', 'complete_response', 'approved'];
      return order.indexOf(candidateOutlook(a, dashboard.assessments?.[a.id])) - order.indexOf(candidateOutlook(b, dashboard.assessments?.[b.id])) || a.drug.localeCompare(b.drug);
    }
    if (sort === 'name') return a.drug.localeCompare(b.drug);
    if (sort === 'sources') return sourceIds(b).length - sourceIds(a).length || a.drug.localeCompare(b.drug);
    return (candidateActionDate(a).date ?? '9999').localeCompare(candidateActionDate(b).date ?? '9999') || a.drug.localeCompare(b.drug);
  }), [candidates, query, status, month, sponsor, outlook, sort, extraSources, dashboard.assessments]);
  const hasFilters = Boolean(query || status || month || sponsor || outlook);
  const clearFilters = () => { setQuery(''); setStatus(''); setMonth(''); setSponsor(''); setOutlook(''); };
  const counts = outlookCounts(filterCandidates(candidates, { query, status, month, sponsor }), dashboard.assessments);
  return <section className="candidate-overview">
    <div className="overview-page-heading"><div><h1>Investigate the approval case</h1><p>Astra follows public evidence, reconciles contradictions and tests the conclusion.</p></div>{selectedCandidate && <button className="text-button resume-candidate" onClick={onResume}>Return to {selectedCandidate.drug}<ArrowRight size={14} /></button>}</div>
    <ResearchMissions dashboard={dashboard} onOpen={(id, runId) => onSelect(id, true, runId)} />
    <div className="overview-outlooks"><div className="overview-outlook-heading"><h2>Astra outlooks</h2><span>Qualitative assessments, not approval probabilities</span>{outlook && <button className="text-button" onClick={() => setOutlook('')}>Show all outlooks<X size={12} /></button>}</div><div className="outlook-distribution" aria-label="Filter by outlook">{OUTLOOK_ORDER.filter((category) => category !== 'complete_response' || counts[category] > 0 || outlook === category).map((category) => <button className={`outlook-filter outlook-${category} ${outlook === category ? 'selected' : ''}`} key={category} aria-pressed={outlook === category} onClick={() => setOutlook(outlook === category ? '' : category)}><span><i className="outlook-dot" aria-hidden="true" />{OUTLOOK_LABELS[category]}</span><strong>{counts[category]}</strong></button>)}</div></div>
    <div className="catalog-toolbar"><div className="catalog-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search drug, indication, sponsor or trial…" aria-label="Search all candidates" />{query && <button aria-label="Clear candidate search" onClick={() => setQuery('')}><X size={14} /></button>}</div><div className="catalog-filters">
      <label><span className="sr-only">Review status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><ChevronDown size={13} /></label>
      <label><CalendarDays size={14} /><span className="sr-only">Action or target month</span><select value={month} onChange={(event) => setMonth(event.target.value)}><option value="">Any action / target month</option>{months.map((value) => <option value={value} key={value}>{formatDate(`${value}-01`, { month: 'long', day: undefined, year: 'numeric' })}</option>)}<option value="unknown">Date not disclosed</option></select><ChevronDown size={13} /></label>
      <label className="sponsor-filter"><span className="sr-only">Filter sponsor</span><select value={sponsor} onChange={(event) => setSponsor(event.target.value)}><option value="">All sponsors</option>{sponsorOptions.map((value) => <option value={value} key={value}>{value}</option>)}</select><ChevronDown size={13} /></label>
    </div></div>
    <div className="catalog-table-meta"><span>{filtered.length} of {candidates.length} candidates{hasFilters && <button className="text-button" onClick={clearFilters}>Clear filters <X size={12} /></button>}</span><label><ArrowUpDown size={12} /><span className="sr-only">Sort all candidates</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="date">Action / target date</option><option value="name">Drug name</option><option value="sources">Source coverage</option><option value="outlook">Concerns first</option></select><ChevronDown size={11} /></label></div>
    <div className="catalog-table-wrap"><table className="catalog-table"><thead><tr><th scope="col">Drug and indication</th><th scope="col">Sponsor</th><th scope="col">Astra outlook</th><th scope="col">Review</th><th scope="col">FDA action / target</th><th scope="col">Evidence</th><th scope="col"><span className="sr-only">Open candidate</span></th></tr></thead><tbody>{filtered.map((candidate) => {
      const ids = sourceIds(candidate);
      const actionDate = candidateActionDate(candidate);
      const assessment = dashboard.assessments?.[candidate.id];
      const outlookCategory = candidateOutlook(candidate, assessment);
      const families = [...new Set(ids.map((id) => sources.get(id)?.kind).filter((kind): kind is Source['kind'] => Boolean(kind)))];
      const runCount = dashboard.investigations.filter((run) => run.candidateId === candidate.id).length;
      return <tr key={candidate.id}><td><button className="catalog-drug" onClick={() => onSelect(candidate.id)}>{renderLogo(candidate)}<span><strong>{candidate.drug}</strong><span>{candidate.indication}</span></span></button></td><td><span className="catalog-sponsor">{candidate.sponsor}</span>{candidate.ticker && <span className="catalog-ticker">{candidate.ticker}</span>}</td><td><button className="catalog-assessment" onClick={() => onSelect(candidate.id)} aria-label={`Open ${OUTLOOK_LABELS[outlookCategory].toLowerCase()} outlook for ${candidate.drug}`}><OutlookBadge category={outlookCategory} />{!actionDate.completed && assessment && <span className="catalog-assessment-scope">{assessment.scope === 'investigation' ? 'Investigated' : 'Initial assessment'}</span>}</button></td><td><span className={`catalog-status ${candidate.status}`}>{statusLabels[candidate.status]}</span><span className="catalog-review">{candidate.reviewType}</span></td><td><span className="catalog-target">{formatDate(actionDate.date)}</span>{actionDate.completed && <span className="catalog-review">{actionDate.shortLabel}</span>}</td><td><button className="catalog-source-button" onClick={() => onSources(ids)}><BookOpen size={12} />{ids.length} sources</button><span className="catalog-source-families" title={families.join(', ')}>{families.length} source {families.length === 1 ? 'family' : 'families'}</span></td><td><button className="catalog-open" onClick={() => onSelect(candidate.id, Boolean(runCount))} aria-label={`${runCount ? 'Open Astra research for' : 'Open evidence for'} ${candidate.drug}`}>{runCount ? 'Research' : 'Open'}<ArrowRight size={13} /></button></td></tr>;
    })}</tbody></table></div>
    {!filtered.length && <div className="catalog-no-results"><Search size={22} /><h2>No candidates match these filters</h2><p>Try a different drug, sponsor or action month.</p><button className="secondary-button" onClick={clearFilters}>Clear filters</button></div>}
    <div className="catalog-context"><p>Completed episodes show their observed FDA action date; pending reviews show the reported target. Filters and sorting use that displayed date. Targets may end in a complete response and are not approval predictions.</p><details><summary>Coverage and methodology</summary><p>{dashboard.catalog.coverage.description}</p><ul>{dashboard.catalog.coverage.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul><p>Evidence as of {formatDate(dashboard.catalog.asOf)}.</p></details></div>
  </section>;
}
