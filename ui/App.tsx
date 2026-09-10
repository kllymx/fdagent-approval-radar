import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowRight, ArrowUpRight, BookOpen, CalendarDays, Download,
  Check, ChevronDown, ChevronRight, CircleAlert, CircleCheck, Clock3,
  ExternalLink, FileText, FlaskConical, Layers3, LoaderCircle, Menu, PanelRightClose,
  Radio, RefreshCw, Search, ShieldCheck, ScanSearch, Target, Table2, Network, X,
} from 'lucide-react';
import { candidateActionDate, dataUrl, formatDate, investigationMarkdown, mergeInvestigationSources, mergeSourceRecords, readInvestigationStream, safeSourceUrl } from './lib';
import type { Candidate, Dashboard, Direction, EvidenceDossier, Finding, Investigation, ModelSummary, RuntimeInfo, Source } from './types';
import CompanyLogos from './CompanyLogos';
import CandidateOverview from './CandidateOverview';
import { DecisionBrief, InvestigationChanges } from './ResearchIntelligence';
import EvidenceMap from './EvidenceMap';
import AssessmentView, { OutlookBadge } from './AssessmentView';
import { candidateOutlook } from './assessment';
import ResearchTrace from './ResearchTrace';
import TrialEvidenceVisual from './TrialEvidenceVisual';
import SourceReviewNotes from './SourceReviewNotes';

type View = 'evidence' | 'analysis' | 'sources' | 'validation';
const STATIC_DEMO = import.meta.env.VITE_STATIC_DEMO === 'true';
const apiDataUrl = (path: string) => dataUrl(path, STATIC_DEMO, import.meta.env.BASE_URL);
const STATUS_LABELS: Record<Candidate['status'], string> = {
  under_review: 'Under FDA review', approved: 'Approved', complete_response: 'Complete response', development: 'In development',
};
const DIRECTION_LABELS: Record<Direction, string> = {
  supportive: 'Supportive', concern: 'Watch closely', unknown: 'Open question', neutral: 'Context',
};

function Logo({ compact = false }: { compact?: boolean }) {
  return <div className={`brand ${compact ? 'compact' : ''}`}>
    <div className="brand-mark" aria-hidden="true"><Activity size={19} /></div>
    <div><span className="brand-name">FDAgent</span></div>
  </div>;
}

function Tag({ children, tone = '' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}

function Sources({ ids, sources, onOpen }: { ids: string[]; sources: Source[]; onOpen: (ids: string[]) => void }) {
  if (!ids.length) return null;
  const uniqueIds = [...new Set(ids)];
  const publishers = [...new Set(uniqueIds.map((id) => sources.find((source) => source.id === id)?.publisher ?? 'Source'))];
  return <div className="citations" aria-label="Supporting sources">
    <button className="citation" onClick={() => onOpen(uniqueIds)} title={publishers.join(', ')}><BookOpen size={12} /><span>{uniqueIds.length} source{uniqueIds.length === 1 ? '' : 's'}</span><ChevronRight size={11} /></button>
  </div>;
}


function EmptyState({ icon = <BookOpen size={24} />, title, detail, action }: { icon?: React.ReactNode; title: string; detail: string; action?: React.ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{detail}</p>{action}</div>;
}

function SourceDrawer({ ids, sources, onClose }: { ids: string[]; sources: Source[]; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const selected = sources.filter((source) => ids.includes(source.id));
  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]');
      if (!focusables?.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prior?.focus(); };
  }, [onClose]);
  return <div className="drawer-backdrop" onClick={onClose}>
    <aside className="source-drawer" role="dialog" aria-modal="true" aria-labelledby="source-drawer-title" ref={panelRef} onClick={(event) => event.stopPropagation()}>
      <div className="drawer-header"><h2 id="source-drawer-title">Sources</h2><button className="icon-button" aria-label="Close evidence library" ref={closeButton} onClick={onClose}><PanelRightClose size={20} /></button></div>
      <p className="drawer-description">Public records behind this outlook. Sponsor statements are attributed to the sponsor; public disclosures may be incomplete.</p>
      <div className="drawer-sources">{selected.map((source, index) => <article className="source-detail" key={source.id}>
        <div className="source-detail-meta"><span className="source-index">{String(index + 1).padStart(2, '0')}</span><Tag>{source.kind === 'fda' ? 'FDA' : source.kind === 'sec' ? 'SEC' : source.kind === 'trial' ? 'Clinical trial' : source.kind === 'sponsor' ? 'Sponsor' : 'Research / web'}</Tag><span>{formatDate(source.publishedAt)}</span></div>
        <h3>{source.title}</h3><p className="source-publisher">{source.publisher}</p><p>{source.summary}</p>
        {source.excerpt && <blockquote>{source.excerpt}</blockquote>}
        {safeSourceUrl(source.url) ? <a className="text-link" href={safeSourceUrl(source.url)} target="_blank" rel="noreferrer">Read original source <ExternalLink size={13} /></a> : <span className="muted">Source URL unavailable</span>}
        <div className="source-retrieved">Retrieved {formatDate(source.retrievedAt)} <span>·</span> {source.id}</div>
      </article>)}</div>
      {!selected.length && <EmptyState title="Source unavailable" detail="This reference was not included in the current evidence packet." />}
      <div className="drawer-footer"><ShieldCheck size={15} />Source presence does not establish scientific validity.</div>
    </aside>
  </div>;
}

function CandidateRail({ candidates, selectedId, onSelect, runtime, asOf, mobileOpen, onClose, savedCandidateIds, showOverview, onOverview, assessments }: {
  candidates: Candidate[]; selectedId: string | null; onSelect: (id: string) => void;
  assessments?: Dashboard['assessments']; runtime: RuntimeInfo; asOf: string; mobileOpen: boolean; onClose: () => void; savedCandidateIds: Set<string>; showOverview: boolean; onOverview: () => void;
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('target');
  const listRef = useRef<HTMLElement>(null);
  const filtered = useMemo(() => candidates.filter((candidate) => `${candidate.drug} ${candidate.indication} ${candidate.sponsor}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => {
    if (sort === 'name') return a.drug.localeCompare(b.drug);
    return (candidateActionDate(a).date ?? '9999').localeCompare(candidateActionDate(b).date ?? '9999');
  }), [candidates, query, sort]);
  useEffect(() => {
    const list = listRef.current;
    const selected = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!list || !selected) return;
    const parentBounds = list.getBoundingClientRect(), bounds = selected.getBoundingClientRect();
    if (bounds.bottom > parentBounds.bottom || bounds.top < parentBounds.top) list.scrollTop += bounds.top - parentBounds.top - 30;
  }, [selectedId, filtered]);
  return <>
    {mobileOpen && <button className="rail-backdrop" onClick={onClose} aria-label="Close candidate navigation" />}
    <aside className={`rail ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="rail-brand"><Logo /><button className="icon-button mobile-close" onClick={onClose} aria-label="Close navigation"><X size={18} /></button></div>
      <button className={`rail-destination ${showOverview ? 'active' : ''}`} onClick={() => { onOverview(); onClose(); }}><Table2 size={16} /><span>All candidates</span></button>
      <div className="rail-section-label"><span>Review watchlist</span><span>{candidates.length}</span></div>
      <div className="rail-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search drug, sponsor…" aria-label="Search candidates" />{query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={13} /></button>}</div>
      <div className="rail-sort"><span>Drug / indication</span><label><span className="sr-only">Sort candidates</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="target">Action / target</option><option value="name">Name A–Z</option></select><ChevronDown size={11} /></label></div>
      <nav className="candidate-list" aria-label="Drug candidates" ref={listRef}>
        {filtered.map((candidate) => { const actionDate = candidateActionDate(candidate); return <button className={`candidate-item ${candidate.id === selectedId && !showOverview ? 'selected' : ''}`} key={candidate.id} aria-current={candidate.id === selectedId && !showOverview ? 'page' : undefined} onClick={() => { onSelect(candidate.id); onClose(); }}>
          <CompanyLogos candidateId={candidate.id} compact /><div className="candidate-item-copy"><div className="candidate-item-heading"><strong>{candidate.drug}</strong>{savedCandidateIds.has(candidate.id) && <span className="candidate-research-badge" title="Saved Astra investigation available"><ScanSearch size={11} /><span className="sr-only">Saved Astra research available</span></span>}</div>
          <p>{candidate.indication}</p>
          <div className="candidate-item-footer"><span>{actionDate.completed && `${actionDate.shortLabel} · `}{actionDate.date ? formatDate(actionDate.date, { month: 'short', day: 'numeric', year: undefined }) : 'Date unknown'}</span><OutlookBadge category={candidateOutlook(candidate, assessments?.[candidate.id])} compact /></div></div>
        </button>; })}
        {!filtered.length && <div className="rail-empty">{query ? 'No candidates match your search.' : 'No candidates published yet.'}</div>}
      </nav>
      <div className="rail-bottom"><div className="runtime-line"><span className={`runtime-dot ${runtime.configured ? 'ready' : ''}`} /><span>{STATIC_DEMO ? 'Recorded Astra research' : runtime.configured ? 'Astra connected' : 'Astra API not configured'}</span></div><p>Evidence as of {formatDate(asOf)}</p></div>
    </aside>
  </>;
}

function CandidateHeader({ candidate, sourceCount, onOpenSources }: { candidate: Candidate; sourceCount: number; onOpenSources: () => void }) {
  const actionDate = candidateActionDate(candidate);
  return <>
    <div className="candidate-header"><div className="candidate-title-block">
      <div className="candidate-title-line"><h1>{candidate.drug}</h1></div>
      <p className="indication">{candidate.indication}</p>
      <div className="sponsor-row"><CompanyLogos candidateId={candidate.id} /><span className="sponsor-name">{candidate.sponsor}</span>{candidate.ticker && <span className="ticker">{candidate.ticker}</span>}</div>
    </div><div className="header-target"><span>{actionDate.completed ? actionDate.label : 'Reported FDA action target'}</span><strong>{actionDate.date ? formatDate(actionDate.date) : 'Not publicly disclosed'}</strong>{actionDate.completed && <p>Completed review episode</p>}</div></div>
    <div className="candidate-meta"><span className={`status-pill ${candidate.status}`}><span />{STATUS_LABELS[candidate.status]}</span><span>{candidate.reviewType}</span>{(!candidate.reviewType.includes(candidate.applicationType) || candidate.applicationNumber) && <span>{candidate.applicationType}{candidate.applicationNumber ? ` ${candidate.applicationNumber}` : ''}</span>}<details className="candidate-metadata"><summary>Details <ChevronDown size={12} /></summary><div><p>{candidate.modality}</p><p>{candidate.phase}</p><p>{candidate.applicationType}{candidate.applicationNumber ? ` ${candidate.applicationNumber}` : ''}</p>{actionDate.completed && candidate.targetDate && <p>Historical reported target: {formatDate(candidate.targetDate)}</p>}{!actionDate.completed && <p>The reported target is a date for FDA action, which may include a complete response. It is not a predicted approval date.</p>}<p>Evidence as of {formatDate(candidate.asOf)}</p></div></details><button className="text-button header-sources" onClick={onOpenSources}><BookOpen size={13} />{sourceCount} sources</button></div>
  </>;
}

function ResearchDesk({ candidate, sources, onOpenSources }: {
  candidate: Candidate; sources: Source[]; onOpenSources: (ids: string[]) => void;
}) {
  const milestones = [...candidate.milestones].sort((a, b) => a.date.localeCompare(b.date));
  return <div className="supporting-evidence">
    <details className="supporting-section timeline-section"><summary><span>Review timeline</span><small>{milestones.length} milestones</small><ChevronDown size={14} /></summary><div className="supporting-content"><p className="dossier-summary">{candidate.summary}</p>
      {milestones.length ? <ol className="timeline">{milestones.map((milestone) => <li key={milestone.id} className={milestone.kind === 'target' ? 'target-event' : ''}>
        <div className="timeline-date">{formatDate(milestone.date, { month: 'short', day: 'numeric', year: undefined })}<span>{milestone.date.slice(0, 4)}</span></div>
        <div className="timeline-track"><span>{milestone.kind === 'target' ? <Target size={11} /> : milestone.kind === 'extension' ? <ArrowRight size={10} /> : <span />}</span></div>
        <div className="timeline-content"><div className="timeline-heading"><h3>{milestone.title}</h3></div><p>{milestone.detail}</p><Sources ids={milestone.sourceIds} sources={sources} onOpen={onOpenSources} /></div>
      </li>)}</ol> : <p className="muted">The evidence packet has no verified dated milestones.</p>}
    </div></details>
    <details className="supporting-section"><summary><span>Supporting signals</span><small>{candidate.signals.length} observations</small><ChevronDown size={14} /></summary><div className="supporting-content">{candidate.signals.map((signal) => <details className={`signal ${signal.direction}`} key={signal.id}><summary><DirectionIcon direction={signal.direction} /><h3>{signal.label}</h3><ChevronDown size={13} /></summary><div className="signal-detail"><p>{signal.detail}</p><Sources ids={signal.sourceIds} sources={sources} onOpen={onOpenSources} /></div></details>)}{!candidate.signals.length && <p className="muted">No candidate-specific signals are included yet.</p>}</div></details>
  </div>;
}

function DirectionIcon({ direction }: { direction: Direction }) {
  if (direction === 'supportive') return <CircleCheck size={14} />;
  if (direction === 'concern') return <CircleAlert size={14} />;
  if (direction === 'unknown') return <Search size={14} />;
  return <Activity size={14} />;
}

function FindingCard({ finding, index, sources, onOpenSources }: { finding: Finding; index: number; sources: Source[]; onOpenSources: (ids: string[]) => void }) {
  return <article className={`finding-card ${finding.direction}`}><div className="finding-number"><DirectionIcon direction={finding.direction} /></div><div><h3>{finding.title}</h3><p>{finding.detail}</p><Sources ids={finding.sourceIds} sources={sources} onOpen={onOpenSources} /></div></article>;
}

function InvestigationView({ candidate, runtime, investigation, busy, progress, partialFindings, error, sources, onOpenSources, onRun, onCancel, history, onLoadRun, loadingRun }: {
  candidate: Candidate; runtime: RuntimeInfo; investigation: Investigation | null; busy: boolean;
  progress: { stage: string; message: string }[]; partialFindings: Finding[]; error: string | null; sources: Source[];
  onOpenSources: (ids: string[]) => void; onRun: (mode: 'investigate' | 'challenge', question?: string) => void;
  onCancel: () => void; history: Dashboard['investigations']; onLoadRun: (id: string) => void; loadingRun: boolean;
}) {
  const [question, setQuestion] = useState('');
  const exportRun = () => {
    if (!investigation) return;
    const blob = new Blob([investigationMarkdown(candidate, investigation, sources)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `approval-radar-${candidate.id}-${investigation.createdAt.slice(0, 10)}.md`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const suggestions = ['What is the strongest case against this outlook?', 'Which historical reviews are most comparable?', 'What new evidence would change your assessment?'];
  return <div className="analysis-layout"><div className="analysis-main">
    <section className={`investigation-intro ${investigation ? 'has-result' : ''}`}><div className="investigation-intro-top"><div className="intro-actions">
      {history.length > (investigation ? 1 : 0) && <label className="history-control"><Clock3 size={14} /><span className="sr-only">Load previous investigation</span><select value={investigation?.id ?? ''} onChange={(event) => event.target.value && onLoadRun(event.target.value)} disabled={busy || loadingRun}><option value="">Previous runs</option>{history.map((run) => <option key={run.id} value={run.id}>{run.provenance === 'recorded' ? 'Recorded' : 'Live run'} · {formatDate(run.createdAt)} · {run.mode}</option>)}</select></label>}
      {investigation && !busy && runtime.configured && <button className="text-button" onClick={() => onRun('investigate')}><RefreshCw size={13} />New investigation</button>}
    </div></div>
    {!investigation && <><h2>Investigate with Astra</h2><p>Examine the evidence, weigh conflicting findings and identify what remains uncertain.</p></>}
    {!runtime.configured && !investigation && <div className="configuration-notice"><CircleAlert size={17} /><div><strong>{STATIC_DEMO ? 'Public demo · recorded Astra runs' : 'Astra is not connected'}</strong><p>{runtime.message ?? 'Set OPENAI_API_KEY and ASTRA_MODEL in the server environment to run live investigations. Source evidence and historical model results remain available.'}</p></div></div>}
    {!investigation && !busy && !loadingRun && <button className="primary-button" disabled={!runtime.configured} onClick={() => onRun('investigate')}><ScanSearch size={15} />Investigate {candidate.drug}<ArrowRight size={15} /></button>}
    </section>
    {error && <div className="error-banner" role="alert"><CircleAlert size={17} /><div><strong>Investigation could not complete</strong><p>{error}</p></div>{runtime.configured && <button className="text-button" onClick={() => onRun('investigate')}>Try again <ArrowRight size={13} /></button>}</div>}
    {loadingRun && <div className="loading-inline" role="status"><LoaderCircle size={18} className="spin" />Loading the saved investigation…</div>}
    {busy && <section className="stream-panel" aria-live="polite"><div className="section-heading"><h2><LoaderCircle className="spin" size={16} />Astra is investigating</h2><button className="text-button" onClick={onCancel}>Stop</button></div><ol className="progress-log">{progress.map((item, index) => <li key={`${index}-${item.stage}`}><span>{index === progress.length - 1 ? <Radio size={13} /> : <Check size={13} />}</span><div><strong>{item.stage.replaceAll('_', ' ')}</strong><p>{item.message}</p></div></li>)}</ol><p className="stream-note">Updates reflect actual research events. Final conclusions appear when the run completes.</p></section>}
    {busy && partialFindings.length > 0 && <section className="section"><div className="section-heading"><h2>Emerging findings</h2><Tag>In progress</Tag></div>{partialFindings.map((finding, index) => <FindingCard finding={finding} index={index} sources={sources} onOpenSources={onOpenSources} key={finding.id} />)}</section>}
    {investigation && !loadingRun && <>
      <div className={`run-provenance ${investigation.provenance}`}><span className="run-provenance-kind">{investigation.provenance === 'recorded' ? <Clock3 size={13} /> : <CircleCheck size={13} />}{investigation.provenance === 'recorded' ? 'Recorded Astra run' : 'Completed live run'}</span><span>{formatDate(investigation.createdAt)}</span><button className="text-button export-run" onClick={exportRun}><Download size={12} />Export brief</button></div>
      {investigation.tools && <ResearchTrace tools={investigation.tools} onSources={onOpenSources} />}
      {investigation.mode === 'challenge' && <details className="challenged-question"><summary><span>Challenge question</span><ChevronDown size={13} /></summary><p>“{investigation.question}”</p></details>}
      <InvestigationChanges investigation={investigation} onOpenSources={onOpenSources} />
      <section className="outlook-panel"><h2>{investigation.outlook.verdict}</h2><p>{investigation.summary}</p><div className="outlook-timing"><CalendarDays size={17} /><div><span>Timing assessment</span><p>{investigation.outlook.timing}</p></div></div><details className="probability-note disclosure"><summary><Activity size={14} /><span>{investigation.outlook.probability != null ? `${Math.round(investigation.outlook.probability * 100)}% · Astra estimate` : 'No candidate-specific probability assigned'}</span><ChevronDown size={13} /></summary><p>{investigation.outlook.probabilityBasis}</p></details></section>
      <SourceReviewNotes runId={investigation.id} />
      {investigation.decisionBrief && <DecisionBrief brief={investigation.decisionBrief} onOpenSources={onOpenSources} />}
      <section className="section findings-section"><div className="section-heading"><h2>What the evidence supports</h2></div>{investigation.findings.map((finding, index) => <FindingCard finding={finding} index={index} sources={sources} onOpenSources={onOpenSources} key={finding.id} />)}</section>
      {investigation.analogs.length > 0 && <details className="section analogs-section disclosure"><summary><Layers3 size={16} /><span>Historical comparisons</span><ChevronDown size={14} /></summary>{investigation.analogs.map((analog, index) => <article className="analog" key={`${index}-${analog.title}`}><h3>{analog.title}</h3><p>{analog.relevance}</p><div className="analog-difference"><span>Key difference</span><p>{analog.difference}</p></div><Sources ids={analog.sourceIds} sources={sources} onOpen={onOpenSources} /></article>)}</details>}
      {investigation.limitations.length > 0 && <details className="limitations-details"><summary><ShieldCheck size={15} />Scope and limitations <ChevronDown size={14} /></summary><ul>{investigation.limitations.map((item) => <li key={item}>{item}</li>)}</ul></details>}
    </>}
  </div><aside className="analysis-aside">
    <section className="challenge-panel"><div className="section-heading"><h2><Target size={16} />Challenge the outlook</h2></div><p>Give Astra a specific assumption to test against the public evidence.</p><form onSubmit={(event) => { event.preventDefault(); if (question.trim()) onRun(investigation ? 'challenge' : 'investigate', question.trim()); }}><label className="sr-only" htmlFor="challenge-question">Question for Astra</label><textarea id="challenge-question" placeholder="What could make this assessment wrong?" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={2000} disabled={busy} /><button className="primary-button" disabled={busy || !runtime.configured || !question.trim()} type="submit"><ScanSearch size={14} />{investigation ? 'Challenge with Astra' : 'Ask Astra'}<ArrowRight size={14} /></button></form><div className="suggestions">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => setQuestion(suggestion)} disabled={busy}>{suggestion}<ArrowUpRight size={13} /></button>)}</div></section>
    {investigation?.nextEvidence.length ? <section className="section next-evidence"><div className="section-heading"><h2><Search size={15} />What to watch next</h2></div><ol>{investigation.nextEvidence.map((item, index) => <li key={item}><span>{String(index + 1).padStart(2, '0')}</span><p>{item}</p></li>)}</ol></section> : <div className="note-box"><BookOpen size={16} /><p>An investigation will identify the public evidence that could materially change the outlook.</p></div>}
    {investigation?.usage && <details className="run-details disclosure"><summary><span>Run details</span><ChevronDown size={13} /></summary><dl><div><dt>Model</dt><dd>{investigation.model}</dd></div><div><dt>Input tokens</dt><dd>{investigation.usage.inputTokens.toLocaleString()}</dd></div><div><dt>Output tokens</dt><dd>{investigation.usage.outputTokens.toLocaleString()}</dd></div><div><dt>Run ID</dt><dd>{investigation.id}</dd></div></dl></details>}
  </aside></div>;
}

function ModelChart({ series }: { series: NonNullable<ModelSummary['series']> }) {
  const points = series.flatMap((item) => item.points);
  if (!points.length) return null;
  const maxMonth = Math.max(...points.map((point) => point.month), 1);
  const colors = ['#2666d3', '#718e9a', '#ba8b42', '#806bae'];
  const x = (month: number) => 52 + month / maxMonth * 558;
  const y = (probability: number) => 222 - Math.max(0, Math.min(1, probability)) * 184;
  return <div className="model-chart"><svg viewBox="0 0 640 260" role="img" aria-label="Historical cohort model probability by month">
    {[0, 0.25, 0.5, 0.75, 1].map((value) => <g key={value}><line x1="52" y1={y(value)} x2="610" y2={y(value)} stroke="#e7ebf1" /><text x="39" y={y(value) + 4} textAnchor="end" fill="#7b8597" fontSize="11">{value * 100}%</text></g>)}
    {[0, Math.round(maxMonth / 2), maxMonth].map((month) => <text key={month} x={x(month)} y="243" textAnchor="middle" fill="#7b8597" fontSize="11">{month} mo</text>)}
    {series.map((item, index) => <polyline key={item.label} fill="none" stroke={colors[index % colors.length]} strokeWidth="2.5" points={item.points.map((point) => `${x(point.month)},${y(point.probability)}`).join(' ')} />)}
  </svg><div className="chart-legend">{series.map((item, index) => <span key={item.label}><i style={{ background: colors[index % colors.length] }} />{item.label}</span>)}</div></div>;
}

function EmpiricalResults({ model }: { model: ModelSummary }) {
  const [reviewClass, setReviewClass] = useState<'priority' | 'standard'>('priority');
  const prior = model.approvalRatePrior;
  const history = model.reviewHistories?.histories ?? [];
  const [selectedHistory, setSelectedHistory] = useState<string | null>(null);
  const activeHistory = history.find((item) => item.id === selectedHistory);
  const rates = prior?.heldOutPredictions.filter((item) => item.reviewClass === reviewClass) ?? [];
  const current = prior?.current[reviewClass];
  const maxMonths = Math.max(...history.map((item) => item.totalMonths), 1);
  return <>
    {prior && <section className="section empirical-section"><div className="section-heading"><h2>First-cycle approval: forecast vs. outcome</h2><div className="segmented" aria-label="Review class"><button className={reviewClass === 'priority' ? 'active' : ''} onClick={() => setReviewClass('priority')}>Priority</button><button className={reviewClass === 'standard' ? 'active' : ''} onClick={() => setReviewClass('standard')}>Standard</button></div></div>
      <p className="empirical-description">A forecast of the annual review-class approval rate. Each row is a fiscal-year cohort, not an individual drug.</p>
      <div className="holdout-lineage"><div><span>Training</span><strong>FY{prior.train.receiptFiscalYears[0]}–{String(prior.train.receiptFiscalYears.at(-1)).slice(-2)}</strong></div><ArrowRight size={14} /><div><span>Forecast cutoff</span><strong>{formatDate(prior.test.forecastCutoff)}</strong></div><ArrowRight size={14} /><div><span>Held out</span><strong>FY{prior.test.receiptFiscalYears[0]}–{String(prior.test.receiptFiscalYears.at(-1)).slice(-2)}</strong></div></div>
      <div className="forecast-comparison"><div className="comparison-head"><span>Receipt year</span><span>Approval rate</span><span>Actual / forecast</span></div>{rates.map((point) => <div className="comparison-row" key={`${point.receiptFiscalYear}-${point.reviewClass}`}><span>FY{point.receiptFiscalYear}</span><div className="comparison-bars" role="img" aria-label={`FY${point.receiptFiscalYear}: actual ${point.firstCycleApprovalPercent} percent, forecast ${(point.prediction * 100).toFixed(1)} percent`}><div className="bar-actual" style={{ width: `${point.firstCycleApprovalPercent}%` }} /><div className="bar-predicted" style={{ width: `${point.prediction * 100}%` }} /></div><span><strong>{point.firstCycleApprovalPercent}%</strong> / {(point.prediction * 100).toFixed(1)}%</span></div>)}<div className="comparison-legend"><span><i />Observed annual rate</span><span><i />Frozen class forecast</span></div></div>
      <div className="baseline-comparison"><div><span>Class-specific mean error</span><strong>{prior.evaluation.class_mean?.maePercentagePoints.toFixed(1)} <small>pp</small></strong></div><div><span>Pooled baseline error</span><strong>{prior.evaluation.pooled_mean?.maePercentagePoints.toFixed(1)} <small>pp</small></strong></div><p>Both measured across all six held-out year/class observations. Lower error is better. Reported rates are rounded by FDA.</p></div>
      {current && <div className="current-prior"><div><span>Current {reviewClass} review baseline</span><strong>{(current.meanRate * 100).toFixed(1)}<small>%</small></strong></div><p>Mean of {current.annualCohortCount} annual cohort rates. Observed annual range {(current.annualObservedRange[0] * 100).toFixed(0)}–{(current.annualObservedRange[1] * 100).toFixed(0)}%. <b>This is not a candidate's approval probability.</b></p></div>}
    </section>}
    {model.actionTiming && <details className="section empirical-section disclosure"><summary><span>Action timing evaluation</span><ChevronDown size={14} /></summary><p className="empirical-description">Scored on {model.actionTiming.test.dueOrResolved} due or resolved action outcomes, with {model.actionTiming.test.pendingWithinGoal} pending cases kept unresolved. An on-time action may be a complete response.</p><div className="timing-results"><div className="timing-table-head"><span>Method</span><span>Brier score ↓</span></div>{Object.entries(model.actionTiming.evaluation).map(([key, result]) => <div className="timing-table-row" key={key}><span>{key === 'class_beta_binomial' ? 'By review class' : key === 'pooled_beta_binomial' ? 'Pooled baseline' : key === 'policy_90_percent' ? '90% policy baseline' : key.replaceAll('_', ' ')}</span><strong>{result.brier.toFixed(4)}</strong></div>)}</div><p className="empirical-verdict">{model.actionTiming.evaluation.pooled_beta_binomial?.brier < model.actionTiming.evaluation.class_beta_binomial?.brier ? 'The pooled baseline performed better on this holdout. Adding review class did not improve the timing score.' : 'Compare the class-conditioned method with simpler baselines before using the estimate.'}</p></details>}
    {history.length > 0 && <details className="section review-paths-section disclosure"><summary><span>Historical review paths</span><ChevronDown size={14} /></summary><p className="empirical-description">Selected FDA review histories for applications approved in FY2025. These illustrate paths, not outcome frequencies or candidate similarity.</p><div className="review-path-legend"><span><i />FDA review</span><span><i />Sponsor response</span><span>CR · Complete response</span></div><div className="review-paths">{history.map((item) => <button className={`review-path-row ${item.id === selectedHistory ? 'selected' : ''}`} key={item.id} onClick={() => setSelectedHistory(item.id === selectedHistory ? null : item.id)} aria-expanded={item.id === selectedHistory}><span className="review-path-drug">{item.drug}</span><span className="review-path-track">{item.timeline.map((segment, index) => <span className={`review-segment ${segment.stage === 'Sponsor response' ? 'sponsor-response' : 'fda-review'}`} style={{ width: `${segment.months / maxMonths * 100}%` }} key={index} title={`${segment.stage}: ${segment.months} months${segment.outcome ? ` · ${segment.outcome === 'CR' ? 'Complete response' : segment.outcome === 'AP' ? 'Approval' : segment.outcome}` : ''}`}>{segment.outcome === 'CR' && <i />}</span>)}</span><span className="review-path-duration">{item.totalMonths.toFixed(1)} mo</span><ChevronDown size={12} /></button>)}</div>{activeHistory && <div className="review-path-detail"><span className="eyebrow">{activeHistory.drug} · {activeHistory.reviewClass} review</span><p>{activeHistory.lesson}</p><ol>{activeHistory.timeline.map((segment, index) => <li key={index}><span>{segment.stage}</span><strong>{segment.months} mo</strong>{segment.outcome && <Tag tone={segment.outcome === 'CR' ? 'concern' : 'supportive'}>{segment.outcome === 'CR' ? 'Complete response' : segment.outcome === 'AP' ? 'Approval' : segment.outcome}</Tag>}</li>)}</ol>{safeSourceUrl(activeHistory.sourceUrl) && <a className="text-link" href={safeSourceUrl(activeHistory.sourceUrl)} target="_blank" rel="noreferrer">Open FDA review history <ExternalLink size={12} /></a>}</div>}<div className="review-path-note">Select a review to inspect its sequence. Chart width represents total elapsed months.</div></details>}
    {model.sources?.length ? <details className="section model-source-section disclosure"><summary><BookOpen size={16} /><span>Model sources</span><ChevronDown size={14} /></summary><div className="model-source-list">{model.sources.map((source) => safeSourceUrl(source.url) && <a key={source.id} href={safeSourceUrl(source.url)} target="_blank" rel="noreferrer"><FileText size={13} /><span>{source.title}</span><ArrowUpRight size={12} /></a>)}</div></details> : null}
  </>;
}

function ValidationView({ model, coverage }: { model: ModelSummary; coverage: Dashboard['catalog']['coverage'] }) {
  return <div className="validation-layout"><div className="validation-main"><section className="validation-intro"><h2>Model validation</h2><p>Historical cohort results, evaluated against simpler baselines. These are not individual approval probabilities.</p></section>
    <section className="section model-section"><div className="section-heading"><h2>{model.title || 'Historical review baseline'}</h2><Tag tone={model.status === 'evaluated' ? 'supportive' : ''}>{model.status === 'evaluated' ? 'Evaluated' : model.status === 'exploratory' ? 'Exploratory' : 'Unavailable'}</Tag></div><p className="model-summary">{model.summary}</p>
      {model.status !== 'unavailable' && <><div className="model-metrics">{model.metrics.map((metric) => <div className="metric" key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong>{metric.detail && <p>{metric.detail}</p>}</div>)}</div>{model.series?.length ? <ModelChart series={model.series} /> : null}<div className="model-footnote"><span>{model.cohortSize.toLocaleString()} {model.cohortSizeUnit ?? 'cohort observations'}</span>{(model.updatedAt ?? model.generatedAt) && <span>Updated {formatDate(model.updatedAt ?? model.generatedAt)}</span>}</div></>}
      {model.status === 'unavailable' && <EmptyState icon={<FlaskConical size={24} />} title="No validated model published" detail="Candidate probabilities will not be displayed as model results until a defensible dataset and evaluation are available." />}
    </section>
    <EmpiricalResults model={model} />
    <details className="section disclosure"><summary><ShieldCheck size={16} /><span>Model limitations</span><ChevronDown size={14} /></summary><ol className="model-limitations">{model.limitations.map((item, index) => <li key={item}><span>{String(index + 1).padStart(2, '0')}</span><p>{item}</p></li>)}</ol></details>
  </div><aside className="validation-aside"><details className="principles-card disclosure"><summary><span>How to read these results</span><ChevronDown size={14} /></summary><div className="principle"><span>01</span><div><h4>Public evidence</h4><p>Dated records and attributed disclosures about this drug and indication.</p></div></div><div className="principle"><span>02</span><div><h4>Historical baseline</h4><p>Measured outcomes in the stated cohort. A population rate is not an individualized forecast.</p></div></div><div className="principle"><span>03</span><div><h4>Astra assessment</h4><p>A source-linked interpretation of the candidate, including unresolved questions and counterevidence.</p></div></div></details><details className="section coverage-section disclosure"><summary><span>Dataset coverage</span><ChevronDown size={14} /></summary><h3>{coverage.title}</h3><p>{coverage.description}</p><ul>{coverage.limitations.map((item) => <li key={item}>{item}</li>)}</ul></details></aside></div>;
}

export default function App() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<View>('evidence');
  const [showOverview, setShowOverview] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sourceIds, setSourceIds] = useState<string[] | null>(null);
  const [investigation, setInvestigation] = useState<Investigation | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingRun, setLoadingRun] = useState(false);
  const [progress, setProgress] = useState<{ stage: string; message: string }[]>([]);
  const [partialFindings, setPartialFindings] = useState<Finding[]>([]);
  const [investigationError, setInvestigationError] = useState<string | null>(null);
  const [dossiers, setDossiers] = useState<Record<string, EvidenceDossier>>({});
  const [researchSources, setResearchSources] = useState<Record<string, Source[]>>({});
  const [loadingDossier, setLoadingDossier] = useState(false);
  const [gatheringEvidence, setGatheringEvidence] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const evidenceRequestRef = useRef<AbortController | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const runSequence = useRef(0);
  const historyRequestRef = useRef<AbortController | null>(null);
  const loadDashboard = useCallback(async (signal?: AbortSignal) => {
    setRefreshing(true);
    try {
      const response = await fetch(apiDataUrl('/api/dashboard'), { signal });
      if (!response.ok) throw new Error(`The evidence service returned ${response.status}.`);
      const data = await response.json() as Dashboard;
      if (!data.catalog || !Array.isArray(data.catalog.candidates) || !data.runtime || !data.model) throw new Error('The evidence service returned an unexpected data format.');
      if (STATIC_DEMO) data.runtime = { ...data.runtime, configured: false, status: 'unconfigured', message: 'Public demo — recorded Astra runs. Run locally with Astra access for live research.' };
      setDashboard(data);
      setSelectedId((current) => current && data.catalog.candidates.some((candidate) => candidate.id === current) ? current : (STATIC_DEMO ? data.catalog.candidates.find((candidate) => data.investigations.some((run) => run.candidateId === candidate.id))?.id : null) ?? data.catalog.candidates[0]?.id ?? null);
      setLoadError(null);
    } catch (error) {
      if (signal?.aborted) return;
      setLoadError(error instanceof Error ? error.message : 'Could not load the evidence catalog.');
    } finally { if (!signal?.aborted) setRefreshing(false); }
  }, []);
  useEffect(() => { const controller = new AbortController(); void loadDashboard(controller.signal); return () => controller.abort(); }, [loadDashboard]);
  useEffect(() => () => { requestRef.current?.abort(); historyRequestRef.current?.abort(); evidenceRequestRef.current?.abort(); }, []);
  useEffect(() => {
    if (!selectedId || !dashboard) return;
    const controller = new AbortController();
    const candidateId = selectedId;
    setEvidenceError(null);
    evidenceRequestRef.current?.abort();
    setGatheringEvidence(false);
    const canLoadDossier = !STATIC_DEMO || dashboard.evidenceCandidateIds?.includes(candidateId);
    setLoadingDossier(Boolean(canLoadDossier));
    if (canLoadDossier) void (async () => {
      try {
        const response = await fetch(apiDataUrl(`/api/evidence/${encodeURIComponent(candidateId)}`), { signal: controller.signal });
        if (response.status === 404) return;
        if (!response.ok) throw new Error(`Evidence dossier returned ${response.status}.`);
        const dossier = await response.json() as EvidenceDossier;
        if (dossier.candidateId !== candidateId || !Array.isArray(dossier.families)) throw new Error('The evidence service returned an unexpected dossier.');
        setDossiers((current) => ({ ...current, [candidateId]: dossier }));
      } catch (error) { if (!controller.signal.aborted) setEvidenceError(error instanceof Error ? error.message : 'The evidence dossier could not be loaded.'); }
      finally { if (!controller.signal.aborted) setLoadingDossier(false); }
    })();
    const priorRuns = dashboard.investigations.filter((run) => run.candidateId === candidateId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (priorRuns.length) void (async () => {
      const results = await Promise.allSettled(priorRuns.map(async (run) => {
        const response = await fetch(apiDataUrl(`/api/investigations/${encodeURIComponent(run.id)}`), { signal: controller.signal });
        if (!response.ok) return null;
        const research = await response.json() as Investigation;
        return research.candidateId === candidateId ? research : null;
      }));
      if (controller.signal.aborted) return;
      const runs = results.flatMap((result) => result.status === 'fulfilled' && result.value ? [result.value] : []);
      setResearchSources((current) => ({ ...current, [candidateId]: mergeInvestigationSources(runs) }));
    })();
    return () => controller.abort();
  }, [selectedId, dashboard?.evidenceCandidateIds, dashboard?.investigations]);
  const candidate = dashboard?.catalog.candidates.find((item) => item.id === selectedId);
  const allSources = useMemo(() => mergeSourceRecords(
    dashboard?.catalog.sources ?? [],
    investigation?.sources ?? [],
    Object.values(researchSources).flat(),
    Object.values(dashboard?.evidenceSourcesByCandidate ?? {}).flat(),
    Object.values(dossiers).sort((a, b) => a.generatedAt.localeCompare(b.generatedAt)).flatMap((dossier) => dossier.sources),
  ), [dashboard, investigation, researchSources, dossiers]);
  const candidateSourceIds = useMemo(() => candidate ? [...new Set([...candidate.sourceIds, ...candidate.milestones.flatMap((item) => item.sourceIds), ...candidate.signals.flatMap((item) => item.sourceIds), ...(dashboard?.evidenceSourcesByCandidate?.[candidate.id] ?? []).map((source) => source.id), ...(researchSources[candidate.id] ?? []).map((source) => source.id), ...(dossiers[candidate.id]?.sources ?? []).map((source) => source.id), ...(investigation?.candidateId === candidate.id ? investigation.sources.map((source) => source.id) : [])])] : [], [candidate, dashboard?.evidenceSourcesByCandidate, researchSources, dossiers, investigation]);
  const gatherEvidence = async () => {
    if (!candidate || STATIC_DEMO || gatheringEvidence) return;
    const candidateId = candidate.id;
    const controller = new AbortController(); evidenceRequestRef.current = controller;
    setGatheringEvidence(true); setEvidenceError(null);
    try {
      const response = await fetch(`/api/evidence/${encodeURIComponent(candidateId)}`, { method: 'POST', signal: controller.signal });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message ?? payload?.error?.message ?? payload?.error ?? `Evidence gathering failed (${response.status}).`);
      const dossier = payload as EvidenceDossier;
      if (dossier.candidateId !== candidateId || !Array.isArray(dossier.families)) throw new Error('The evidence service returned an unexpected dossier.');
      setDossiers((current) => ({ ...current, [candidateId]: dossier }));
    } catch (error) { if (!controller.signal.aborted) setEvidenceError(error instanceof Error ? error.message : 'Evidence gathering failed.'); }
    finally { if (!controller.signal.aborted) setGatheringEvidence(false); }
  };
  const closeSources = useCallback(() => setSourceIds(null), []);
  const selectCandidate = (id: string) => {
    setShowOverview(false);
    if (id === selectedId) return;
    runSequence.current += 1;
    requestRef.current?.abort(); historyRequestRef.current?.abort();
    setSelectedId(id); setInvestigation(null); setInvestigationError(null); setPartialFindings([]); setProgress([]); setBusy(false); setLoadingRun(false); setSourceIds(null); setView('evidence');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const loadRun = async (id: string, expectedCandidateId = selectedId) => {
    if (busy && expectedCandidateId === selectedId) return;
    historyRequestRef.current?.abort();
    const controller = new AbortController(); historyRequestRef.current = controller;
    setLoadingRun(true); setInvestigationError(null); setView('analysis');
    try {
      const response = await fetch(apiDataUrl(`/api/investigations/${encodeURIComponent(id)}`), { signal: controller.signal });
      if (!response.ok) throw new Error('The saved investigation could not be loaded.');
      const run = await response.json() as Investigation;
      if (controller.signal.aborted || historyRequestRef.current !== controller) return;
      if (run.candidateId !== expectedCandidateId) throw new Error('This investigation belongs to a different candidate.');
      setInvestigation(run);
    } catch (error) { if (!controller.signal.aborted) setInvestigationError(error instanceof Error ? error.message : 'Could not load the investigation.'); }
    finally { if (!controller.signal.aborted) setLoadingRun(false); }
  };
  const openAnalysis = () => {
    setView('analysis');
    if (investigation || busy || loadingRun) return;
    const savedRun = dashboard?.investigations.find((run) => run.candidateId === selectedId);
    if (savedRun) void loadRun(savedRun.id);
  };
  const runInvestigation = async (mode: 'investigate' | 'challenge' = 'investigate', question?: string) => {
    if (!candidate || busy || !dashboard?.runtime.configured) return;
    historyRequestRef.current?.abort();
    setLoadingRun(false);
    const sequence = ++runSequence.current;
    const controller = new AbortController(); requestRef.current = controller;
    setBusy(true); setView('analysis'); setProgress([{ stage: 'connecting', message: 'Requesting a live investigation from the Astra research service.' }]); setPartialFindings([]); setInvestigationError(null);
    try {
      const response = await fetch('/api/investigate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidateId: candidate.id, mode, question, previousRunId: mode === 'challenge' ? investigation?.id : undefined }), signal: controller.signal });
      await readInvestigationStream(response, (event) => {
        if (sequence !== runSequence.current) return;
        if (event.type === 'started') setProgress([{ stage: 'started', message: `Investigation ${event.runId} started with ${event.model}.` }]);
        if (event.type === 'progress') setProgress((current) => [...current, { stage: event.stage, message: event.message }]);
        if (event.type === 'finding') setPartialFindings((current) => [...current.filter((finding) => finding.id !== event.finding.id), event.finding]);
        if (event.type === 'complete') {
          setInvestigation(event.investigation);
          setResearchSources((current) => ({ ...current, [event.investigation.candidateId]: mergeSourceRecords(current[event.investigation.candidateId] ?? [], event.investigation.sources) }));
          setDashboard((current) => {
            if (!current) return current;
            const run = event.investigation;
            const manifest = current.evidenceSourcesByCandidate?.[run.candidateId] ?? [];
            const hasNewerRun = current.investigations.some((item) => item.candidateId === run.candidateId && item.createdAt > run.createdAt);
            return { ...current, evidenceSourcesByCandidate: { ...current.evidenceSourcesByCandidate, [run.candidateId]: hasNewerRun ? mergeSourceRecords(run.sources, manifest) : mergeSourceRecords(manifest, run.sources) }, investigations: [{ id: run.id, candidateId: run.candidateId, model: run.model, createdAt: run.createdAt, mode: run.mode, provenance: run.provenance, summary: run.summary }, ...current.investigations.filter((item) => item.id !== run.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
          });
          if (event.investigation.evidenceAssessment) void loadDashboard();
        }
      });
    } catch (error) {
      if (sequence === runSequence.current) setInvestigationError(controller.signal.aborted ? 'The investigation was stopped. You can start a new run.' : error instanceof Error ? error.message : 'The investigation failed.');
    } finally { if (sequence === runSequence.current) setBusy(false); }
  };

  if (!dashboard) return <div className="boot-screen"><Logo /><div className="boot-panel">{loadError ? <><CircleAlert size={28} /><h1>Evidence service unavailable</h1><p>{loadError}</p><p className="muted">Check that the API server is running, then retry.</p><button className="primary-button" onClick={() => void loadDashboard()} disabled={refreshing}><RefreshCw className={refreshing ? 'spin' : ''} size={15} />Retry connection</button></> : <><LoaderCircle size={28} className="spin" /><h1>Opening the research desk</h1><p>Loading public evidence and model results…</p></>}</div></div>;

  return <div className="app-shell"><CandidateRail candidates={dashboard.catalog.candidates} selectedId={selectedId} onSelect={selectCandidate} runtime={dashboard.runtime} asOf={dashboard.catalog.asOf} assessments={dashboard.assessments} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} savedCandidateIds={new Set(dashboard.investigations.map((run) => run.candidateId))} showOverview={showOverview} onOverview={() => { setShowOverview(true); window.scrollTo({ top: 0, behavior: 'instant' }); }} />
    <div className="workspace"><header className="topbar"><div className="topbar-location"><button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open candidate navigation"><Menu size={19} /></button><span className="topbar-product">Approval Radar</span><ChevronRight size={12} /><span>{showOverview ? 'All candidates' : view === 'validation' ? 'Model validation' : candidate?.drug ?? 'Research desk'}</span></div><div className="topbar-right"><Tag tone="blue">{STATIC_DEMO ? 'Public demo' : 'Research beta'}</Tag><button className="icon-button" onClick={() => void loadDashboard()} disabled={refreshing || busy} aria-label="Reload evidence catalog" title="Reload evidence catalog"><RefreshCw size={14} className={refreshing ? 'spin' : ''} /></button></div></header>
    <main className="main-content">{loadError && <div className="error-banner" role="alert"><CircleAlert size={15} /><p>Refresh failed. Showing the last loaded catalog. {loadError}</p></div>}
      {showOverview ? <CandidateOverview dashboard={dashboard} selectedCandidate={candidate} onResume={() => setShowOverview(false)} onSelect={(id, analysis, runId) => { selectCandidate(id); if (!analysis) setView('evidence'); if (analysis) { const run = dashboard.investigations.find((item) => item.candidateId === id && (!runId || item.id === runId)); if (run) void loadRun(run.id, id); } }} renderLogo={(item) => <CompanyLogos candidateId={item.id} compact />} onSources={setSourceIds} extraSources={Object.fromEntries(dashboard.catalog.candidates.map((item) => [item.id, mergeSourceRecords(investigation?.candidateId === item.id ? investigation.sources : [], researchSources[item.id] ?? [], dashboard.evidenceSourcesByCandidate?.[item.id] ?? [], dossiers[item.id]?.sources ?? [])]))} /> : candidate ? <><CandidateHeader candidate={candidate} sourceCount={candidateSourceIds.length} onOpenSources={() => setSourceIds(candidateSourceIds)} /><div className="view-tabs" role="tablist" aria-label="Research view">{([{ id: 'evidence', label: 'Evidence desk', icon: BookOpen }, { id: 'analysis', label: 'Astra investigation', icon: ScanSearch }, { id: 'sources', label: 'Evidence map', icon: Network }, { id: 'validation', label: 'Model validation', icon: FlaskConical }] as const).map((tab) => <button key={tab.id} id={`tab-${tab.id}`} role="tab" aria-selected={view === tab.id} aria-controls={`panel-${tab.id}`} className={view === tab.id ? 'active' : ''} onClick={() => tab.id === 'analysis' ? openAnalysis() : setView(tab.id)}><tab.icon size={15} />{tab.label}{tab.id === 'analysis' && busy && <span className="tab-working" />}</button>)}</div>
        <div key={candidate.id} role="tabpanel" id={`panel-${view}`} aria-labelledby={`tab-${view}`}>
          {view === 'evidence' && <><AssessmentView candidate={candidate} assessment={dashboard.assessments?.[candidate.id]} onSources={setSourceIds} onInvestigation={() => { const reviewedId = dashboard.assessments?.[candidate.id]?.basedOnRunId; const saved = dashboard.investigations.find((run) => run.candidateId === candidate.id && (!reviewedId || run.id === reviewedId)) ?? dashboard.investigations.find((run) => run.candidateId === candidate.id); if (busy || loadingRun) openAnalysis(); else if (saved) void loadRun(saved.id); else if (dashboard.runtime.configured) void runInvestigation(); else openAnalysis(); }} /><TrialEvidenceVisual visuals={dashboard.trialVisuals?.[candidate.id] ?? []} onSources={setSourceIds} /><ResearchDesk candidate={candidate} sources={allSources} onOpenSources={setSourceIds} /></>}
          {view === 'analysis' && <InvestigationView candidate={candidate} runtime={dashboard.runtime} investigation={investigation} busy={busy} progress={progress} partialFindings={partialFindings} error={investigationError} sources={allSources} onOpenSources={setSourceIds} onRun={(mode, question) => void runInvestigation(mode, question)} onCancel={() => requestRef.current?.abort()} history={dashboard.investigations.filter((run) => run.candidateId === candidate.id)} onLoadRun={(id) => void loadRun(id)} loadingRun={loadingRun} />}
          {view === 'sources' && <EvidenceMap sources={allSources.filter((source) => candidateSourceIds.includes(source.id))} dossier={dossiers[candidate.id]} gathering={gatheringEvidence} loading={loadingDossier} error={evidenceError} staticDemo={STATIC_DEMO} onGather={() => void gatherEvidence()} onSources={setSourceIds} />}
          {view === 'validation' && <ValidationView model={dashboard.model} coverage={dashboard.catalog.coverage} />}
        </div></> : <EmptyState icon={<Search size={26} />} title="The watchlist is ready for evidence" detail="Publish the public candidate catalog to begin exploring regulatory milestones and source-linked investigations." action={<button className="secondary-button" onClick={() => void loadDashboard()}><RefreshCw size={14} />Refresh catalog</button>} />}
      <footer className="workspace-footer"><span><ShieldCheck size={13} />Public-source research · Not an FDA determination</span><span>Approval Radar <span className="footer-slash">/</span> FDAgent</span></footer>
    </main></div>{sourceIds !== null && <SourceDrawer ids={sourceIds} sources={allSources} onClose={closeSources} />}
  </div>;
}
