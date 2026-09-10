import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { candidateOutlook, outlookCounts } from './assessment';
import { filterCandidates } from './CandidateOverview';
import AssessmentView from './AssessmentView';
import ResearchTrace from './ResearchTrace';
import type { Assessment, Candidate } from './types';

const candidate = (id: string, status: Candidate['status'] = 'under_review'): Candidate => ({ id, drug: id, status, indication: 'Test indication', sponsor: 'Test sponsor', modality: 'Test', phase: 'Test', reviewType: 'Test', applicationType: 'Test', nctIds: [], targetDate: '2026-10-01', targetDateKind: 'reported', asOf: '2026-09-10', summary: '', sourceIds: [], milestones: [], signals: [] });
const assessment = (id: string, category: Assessment['category']): Assessment => ({ candidateId: id, category, summary: 'Test interpretation', pivotalQuestion: 'What evidence is missing?', factors: [], sourceIds: [], model: 'gpt-6-astra', createdAt: '2026-09-10T12:00:00Z', evidenceAsOf: '2026-09-10', scope: 'initial_packet', basedOnRunId: null, inputHash: 'test', responseId: 'test' });

test('completed FDA actions override model categories and unassessed candidates are never treated as unfavorable', () => {
  assert.equal(candidateOutlook(candidate('approved', 'approved'), assessment('approved', 'concerning')), 'approved');
  assert.equal(candidateOutlook(candidate('crl', 'complete_response'), assessment('crl', 'favorable')), 'complete_response');
  assert.equal(candidateOutlook(candidate('missing')), 'not_assessed');
  const records = [candidate('favorable'), candidate('mixed'), candidate('limited'), candidate('missing'), candidate('approved', 'approved')];
  const assessments = { favorable: assessment('favorable', 'favorable'), mixed: assessment('mixed', 'mixed'), limited: assessment('limited', 'insufficient'), approved: assessment('approved', 'concerning') };
  const counts = outlookCounts(records, assessments);
  assert.equal(Object.values(counts).reduce((sum, count) => sum + count, 0), records.length);
  assert.equal(counts.concerning, 0);
  assert.equal(counts.insufficient, 1);
  assert.equal(counts.not_assessed, 1);
  assert.equal(counts.approved, 1);
  assert.deepEqual(filterCandidates(records, { query: '', status: 'under_review', month: '2026-10', sponsor: 'Test sponsor', outlook: 'insufficient' }, assessments).map((item) => item.id), ['limited']);
  assert.equal(filterCandidates(records, { query: '', status: 'approved', month: '', sponsor: '', outlook: 'concerning' }, assessments).length, 0);
});

test('initial assessments state their limited scope and missing factors remain unknown', () => {
  const html = renderToStaticMarkup(createElement(AssessmentView, { candidate: candidate('test'), assessment: assessment('test', 'mixed'), onSources: () => {}, onInvestigation: () => {} }));
  assert.match(html, /Astra approval outlook/);
  assert.match(html, /Mixed case/);
  assert.match(html, /Explore Astra’s reasoning/);
  assert.equal((html.match(/class="primary-button /g) ?? []).length, 1);
  assert.match(html, /Initial assessment/);
  assert.match(html, /curated source summaries/);
  assert.match(html, /not a full investigation/);
  assert.equal((html.match(/factor-unknown /g) ?? []).length, 4);
  assert.match(html, /No calibrated approval probability/);
  const completed = renderToStaticMarkup(createElement(AssessmentView, { candidate: candidate('test', 'approved'), assessment: assessment('test', 'concerning'), onSources: () => {}, onInvestigation: () => {} }));
  assert.match(completed, /FDA approved/);
  assert.match(completed, /FDA review outcome/);
  assert.match(completed, /Observed action/);
  assert.match(completed, /Explore Astra’s reasoning/);
  assert.doesNotMatch(completed, /Concerning|factor-supportive|Initial assessment/);
});

test('completed review hero uses the observed action date and keeps retrospective research accessible', () => {
  const approved = candidate('test', 'approved');
  approved.milestones = [{ id: 'approval', date: '2026-09-03', kind: 'approval', title: 'FDA approval', detail: 'Test approval evidence', sourceIds: [] }];
  const html = renderToStaticMarkup(createElement(AssessmentView, { candidate: approved, assessment: assessment('test', 'concerning'), onSources: () => {}, onInvestigation: () => {} }));
  assert.match(html, /Sep 3, 2026/);
  assert.doesNotMatch(html, /Oct 1, 2026|Material concerns/);
  assert.equal((html.match(/class="primary-button /g) ?? []).length, 1);
});

test('research trail preserves failed and partial tool results rather than displaying a success-only trace', () => {
  const html = renderToStaticMarkup(createElement(ResearchTrace, { tools: [{ name: 'read_source', arguments: { sourceId: 'test-source' }, status: 'partial', durationMs: 0 }, { name: 'search_public_sources', arguments: { query: 'Test query' }, status: 'error', durationMs: 1250 }], onSources: () => {} }));
  assert.match(html, /Partial result/);
  assert.match(html, /Request failed/);
  assert.match(html, /1.3 s/);
  assert.match(html, /Test query/);
});
