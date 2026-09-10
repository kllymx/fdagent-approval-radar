import { BookOpen, ChevronDown, ChevronRight, CircleAlert, Database, ExternalLink, LoaderCircle, RefreshCw, Search } from 'lucide-react';
import { formatDate, safeSourceUrl } from './lib';
import type { EvidenceDossier, Source } from './types';

const sourceFamilies: { kind: Source['kind']; label: string; authority: string }[] = [
  { kind: 'fda', label: 'FDA records', authority: 'Agency records and regulatory correspondence' },
  { kind: 'sec', label: 'SEC filings', authority: 'Issuer disclosures filed with the SEC' },
  { kind: 'trial', label: 'Trial registry', authority: 'Registered study design, status and posted results' },
  { kind: 'publication', label: 'Research and web sources', authority: 'Publications and discovered pages; inspect the original evidence' },
  { kind: 'sponsor', label: 'Sponsor disclosures', authority: 'Company statements, attributed to the sponsor' },
];
const defaultFamilies = [
  { id: 'trials', label: 'ClinicalTrials.gov' }, { id: 'approvals', label: 'Drugs@FDA' },
  { id: 'labels', label: 'Drug labels' }, { id: 'publications', label: 'PubMed publications' },
  { id: 'fdagent', label: 'FDAgent compliance intelligence' },
];
const statusLabels = { ready: 'Collected', empty: 'No matches returned', error: 'Request failed', not_checked: 'Not checked' };

export function groupSourcesByFamily(sources: Source[]): { kind: Source['kind']; label: string; authority: string; sources: Source[] }[] {
  const uniqueSources = [...new Map(sources.map((source) => [source.id, source])).values()];
  return sourceFamilies.map((family) => ({ ...family, sources: uniqueSources.filter((source) => source.kind === family.kind) }));
}

export default function EvidenceMap({ sources, dossier, gathering, loading, error, staticDemo, onGather, onSources }: {
  sources: Source[];
  dossier?: EvidenceDossier;
  gathering: boolean;
  loading: boolean;
  error: string | null;
  staticDemo: boolean;
  onGather: () => void;
  onSources: (ids: string[]) => void;
}) {
  const families = groupSourcesByFamily(sources);
  const total = families.reduce((count, family) => count + family.sources.length, 0);
  return <div className="evidence-map"><div className="evidence-map-heading"><div><h2>Where the evidence comes from</h2><p>{total} source records across the candidate packet, retrieved records and loaded Astra research.</p></div><button className="secondary-button" onClick={() => onSources(sources.map((source) => source.id))}><BookOpen size={14} />View all sources</button></div>
    <div className="evidence-family-grid">{families.map((family) => <article className={`evidence-family ${family.sources.length ? 'covered' : 'missing'}`} key={family.kind}><div className="evidence-family-heading"><h3>{family.label}</h3><span>{family.sources.length}</span></div><p>{family.authority}</p>{family.sources.length ? <button onClick={() => onSources(family.sources.map((source) => source.id))}>Inspect sources<ChevronRight size={12} /></button> : <span className="missing-family">No source in this packet</span>}</article>)}</div>
    <p className="evidence-interpretation">Source coverage is not a quality score. A sponsor claim and an FDA conclusion can concern the same study and still carry different implications.</p>
    <section className="gathered-evidence"><div className="gathered-heading"><div><h2><Database size={16} />Connected public records</h2><p>Query trial, approval, labeling, publication and available compliance sources for this candidate.</p></div><button className="primary-button" disabled={gathering || staticDemo} onClick={onGather}>{gathering ? <LoaderCircle className="spin" size={14} /> : dossier ? <RefreshCw size={14} /> : <Search size={14} />}{gathering ? 'Gathering evidence…' : dossier ? 'Refresh public evidence' : 'Gather public evidence'}</button></div>
      {staticDemo && <p className="evidence-demo-note">Public demo: these are saved source results. Run locally to query current records.</p>}
      {loading && <p className="evidence-loading" role="status"><LoaderCircle size={14} className="spin" />Loading the evidence dossier…</p>}
      {error && <div className="evidence-error" role="alert"><CircleAlert size={15} /><p>{error}</p></div>}
      {dossier && <div className="dossier-provenance"><span>{dossier.provenance === 'recorded' ? 'Recorded source collection' : 'Live source collection'}</span><span>{formatDate(dossier.generatedAt)}</span></div>}
      <div className="gathered-families">{(dossier?.families ?? defaultFamilies.map((family) => ({ ...family, status: 'not_checked' as const, total: null, returned: 0, sourceIds: [], coverage: '', records: [] }))).map((family) => <details className={`gathered-family ${family.status}`} key={family.id}><summary><span>{family.label}</span><span className="gathered-status">{statusLabels[family.status]}{family.status === 'ready' && ` · ${family.returned} records`}</span><ChevronDown size={13} /></summary><div className="family-coverage">{family.coverage ? <p>{family.coverage}</p> : <p>This source family has not been queried for this candidate.</p>}{'error' in family && family.error && <p className="family-error">{String(family.error)}</p>}{family.total !== null && <span>{family.returned} returned of {family.total} matches</span>}</div>
        {family.records.map((record) => <article className="gathered-record" key={record.id}><div><h3>{record.title}</h3>{safeSourceUrl(record.url) && <a href={safeSourceUrl(record.url)} target="_blank" rel="noreferrer" aria-label={`Open original record: ${record.title}`}><ExternalLink size={13} /></a>}</div><p>{record.summary}</p><div className="record-actions">{record.sourceId ? <button onClick={() => onSources([record.sourceId])}>Source details <ChevronRight size={11} /></button> : <span className="source-unlinked">Original source not linked</span>}{Object.keys(record.fields).length > 0 && <details><summary>Record fields</summary><dl>{Object.entries(record.fields).map(([key, value]) => <div key={key}><dt>{key.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ')}</dt><dd>{typeof value === 'string' || typeof value === 'number' ? String(value) : value === null ? 'Not provided' : JSON.stringify(value)}</dd></div>)}</dl></details>}</div></article>)}
      </details>)}</div>
    </section>
  </div>;
}
