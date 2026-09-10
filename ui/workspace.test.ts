import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { filterCandidates } from './CandidateOverview';
import EvidenceMap, { groupSourcesByFamily } from './EvidenceMap';
import { candidateActionDate } from './lib';
import type { Candidate, Source } from './types';

const makeCandidate = (id: string, props: Partial<Candidate>): Candidate => ({ id, drug: id, indication: 'Test indication', sponsor: 'Test sponsor', nctIds: [], status: 'under_review', targetDate: null, sourceIds: [], milestones: [], signals: [], asOf: '2026-09-10', modality: 'Test', phase: 'Test', reviewType: 'Test', applicationType: 'Test', targetDateKind: 'unknown', summary: '', ...props });

test('candidate filters combine search, review status, month and sponsor without treating undisclosed dates as deadlines', () => {
  const candidates = [
    makeCandidate('one', { drug: 'Candidate One', sponsor: 'Sponsor A', targetDate: '2026-09-30', nctIds: ['NCT123'] }),
    makeCandidate('two', { drug: 'Candidate Two', sponsor: 'Sponsor A', targetDate: '2026-12-27', status: 'development' }),
    makeCandidate('three', { sponsor: 'Sponsor B', targetDate: null }),
  ];
  assert.deepEqual(filterCandidates(candidates, { query: '  nct123 ', status: 'under_review', month: '2026-09', sponsor: 'Sponsor A' }).map((item) => item.id), ['one']);
  assert.deepEqual(filterCandidates(candidates, { query: '', status: '', month: 'unknown', sponsor: '' }).map((item) => item.id), ['three']);
  assert.equal(filterCandidates(candidates, { query: 'One', status: 'development', month: '', sponsor: '' }).length, 0);
});

test('evidence families deduplicate identical source IDs and preserve missing families explicitly', () => {
  const source: Source = { id: 'one', kind: 'fda', publisher: 'FDA', title: 'Test record', summary: '', url: 'https://www.fda.gov/example', publishedAt: null, retrievedAt: '2026-09-10' };
  const families = groupSourcesByFamily([source, source, { ...source, id: 'two', kind: 'trial' }]);
  assert.equal(families.find((family) => family.kind === 'fda')?.sources.length, 1);
  assert.equal(families.find((family) => family.kind === 'trial')?.sources.length, 1);
  assert.equal(families.find((family) => family.kind === 'publication')?.sources.length, 0);
  assert.equal(families.length, 5);
});

test('completed episodes display and filter by the observed action, preserving the old target only as history', () => {
  const approved = makeCandidate('approved', { status: 'approved', targetDate: '2026-10-22', milestones: [{ id: 'approval', kind: 'approval', date: '2026-09-03', title: 'FDA approval', detail: '', sourceIds: [] }] });
  assert.deepEqual(candidateActionDate(approved), { date: '2026-09-03', label: 'FDA approval', shortLabel: 'Approved', completed: true });
  assert.equal(approved.targetDate, '2026-10-22');
  assert.equal(filterCandidates([approved], { query: '', status: '', month: '2026-09', sponsor: '' }).length, 1);
  assert.equal(filterCandidates([approved], { query: '', status: '', month: '2026-10', sponsor: '' }).length, 0);
  assert.equal(candidateActionDate({ ...approved, milestones: [] }).date, null);
  assert.equal(candidateActionDate({ ...approved, status: 'under_review' }).date, '2026-10-22');
  const completeResponse = { ...approved, status: 'complete_response' as const, milestones: [{ ...approved.milestones[0], kind: 'crl' as const }] };
  assert.equal(candidateActionDate(completeResponse).label, 'FDA complete response');
  assert.equal(candidateActionDate(completeResponse).date, '2026-09-03');
  assert.equal(candidateActionDate({ ...approved, milestones: [{ ...approved.milestones[0], date: '2026-09-11' }] }).date, null);
});

test('unlinked evidence records remain visible without an empty source drawer action', () => {
  const markup = renderToStaticMarkup(createElement(EvidenceMap, {
    sources: [], gathering: false, loading: false, error: null, staticDemo: true, onGather: () => {}, onSources: () => {},
    dossier: { candidateId: 'test', generatedAt: '2026-09-10', provenance: 'recorded', sources: [], families: [{ id: 'fdagent', label: 'Compliance intelligence', status: 'ready', total: 1, returned: 1, sourceIds: [], coverage: 'A test lead with no original source link.', records: [{ id: 'unlinked', sourceId: '', title: 'Unlinked test lead', url: '', summary: 'Identity is not established.', fields: {} }] }] },
  }));
  assert.match(markup, /Original source not linked/);
  assert.match(markup, /Identity is not established/);
  assert.doesNotMatch(markup, />Source details/);
});
