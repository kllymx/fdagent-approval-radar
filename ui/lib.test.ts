import assert from 'node:assert/strict';
import test from 'node:test';
import { dataUrl, formatDate, investigationMarkdown, mergeInvestigationSources, mergeSourceRecords, readInvestigationStream, safeSourceUrl } from './lib';
import type { Candidate, Investigation, Source, StreamEvent } from './types';

test('NDJSON preserves UTF-8 split across chunks and a final event without newline', async () => {
  const payload = new TextEncoder().encode('{"type":"progress","stage":"research","message":"Evidence → outlook"}\n{"type":"complete","investigation":{"id":"run-test"}}');
  const response = new Response(new ReadableStream({ start(controller) {
    for (const byte of payload) controller.enqueue(new Uint8Array([byte]));
    controller.close();
  } }), { headers: { 'content-type': 'application/x-ndjson' } });
  const events: StreamEvent[] = [];
  await readInvestigationStream(response, (event) => events.push(event));
  assert.equal(events.length, 2);
  assert.deepEqual(events[0], { type: 'progress', stage: 'research', message: 'Evidence → outlook' });
  assert.equal(events[1].type, 'complete');
});

test('NDJSON surfaces JSON API errors and does not treat truncated research as success', async () => {
  await assert.rejects(() => readInvestigationStream(new Response('{"error":"Model unavailable"}', { status: 503, headers: { 'content-type': 'application/json' } }), () => {}), /Model unavailable/);
  await assert.rejects(() => readInvestigationStream(new Response('{"type":"progress","stage":"research","message":"Reading sources"}\n'), () => {}), /before the investigation completed/);
  await assert.rejects(() => readInvestigationStream(new Response('{"type":"error","message":"Source request failed"}\n'), () => {}), /Source request failed/);
  await assert.rejects(() => readInvestigationStream(new Response('broken json'), () => {}), /unreadable event/);
});

test('public demo data URLs honor a repository subpath and reject live-only endpoints', () => {
  assert.equal(dataUrl('/api/dashboard', false, '/radar/'), '/api/dashboard');
  assert.equal(dataUrl('/api/dashboard', true, '/radar/'), '/radar/demo/dashboard.json');
  assert.equal(dataUrl('/api/investigations/run-1', true, '/radar'), '/radar/demo/investigations/run-1.json');
  assert.equal(dataUrl('/api/evidence/candidate-1', true, '/radar/'), '/radar/demo/evidence/candidate-1.json');
  assert.throws(() => dataUrl('/api/investigate', true), /requires the local Astra research server/);
});

test('source links reject executable schemes and calendar dates do not shift time zones', () => {
  assert.equal(safeSourceUrl('javascript:alert(1)'), undefined);
  assert.equal(safeSourceUrl('data:text/html,<script>alert(1)</script>'), undefined);
  assert.equal(safeSourceUrl('https://www.fda.gov/example'), 'https://www.fda.gov/example');
  assert.equal(formatDate('2026-12-27'), 'Dec 27, 2026');
  assert.equal(formatDate(null), 'Not disclosed');
});

test('newer source corrections beat older runs regardless of retrieval order, including unknown publication dates', () => {
  const older: Source = { id: 'shared-source', title: 'Test source', publisher: 'Test publisher', url: 'https://example.com/source', publishedAt: '2026-09-10', retrievedAt: '2026-09-10', kind: 'publication', summary: 'Older metadata.' };
  const corrected = { ...older, publishedAt: null, summary: 'Publication date not established.' };
  const newestFirst = [{ createdAt: '2026-09-10T15:00:00Z', sources: [corrected] }, { createdAt: '2026-09-10T12:00:00Z', sources: [older] }];
  assert.deepEqual(mergeInvestigationSources(newestFirst), [corrected]);
  assert.deepEqual(mergeInvestigationSources([...newestFirst].reverse()), [corrected]);
  assert.equal(newestFirst[0].createdAt, '2026-09-10T15:00:00Z');
  const manifest = mergeSourceRecords([older], [corrected]);
  assert.deepEqual(mergeSourceRecords([older], mergeInvestigationSources(newestFirst), manifest), [corrected]);
  const liveCorrection = { ...corrected, summary: 'A newer live investigation clarified scope.' };
  assert.deepEqual(mergeSourceRecords([older], manifest, mergeSourceRecords(manifest, [liveCorrection])), [liveCorrection]);
});

test('Markdown export preserves provenance, uncertainty and public source links', () => {
  const candidate = { id: 'test', drug: 'Test candidate', indication: 'Test indication', sponsor: 'Test sponsor', asOf: '2026-09-10', targetDate: '2026-12-27', sourceIds: ['test-source'] } as Candidate;
  const run: Investigation = {
    id: 'test-run', candidateId: 'test', model: 'gpt-6-astra', createdAt: '2026-09-10T12:00:00Z', mode: 'investigate', question: '', status: 'completed', provenance: 'recorded', summary: 'Test summary.',
    outlook: { verdict: 'Uncertain', timing: 'Reported target only.', probability: null, probabilityBasis: 'No validated candidate model.' },
    findings: [{ id: 'test-finding', title: 'Review goal', detail: 'Not an approval promise.', direction: 'neutral', sourceIds: ['test-source'] }],
    analogs: [], nextEvidence: ['FDA action.'], limitations: ['Test data used only for unit validation.'],
    sources: [{ id: 'test-source', title: 'Test FDA source', publisher: 'FDA', url: 'https://www.fda.gov/example', publishedAt: '2026-09-01', retrievedAt: '2026-09-10', kind: 'fda', summary: 'Test source.' }],
  };
  const markdown = investigationMarkdown(candidate, run, []);
  assert.match(markdown, /Recorded Astra run/);
  assert.match(markdown, /\*\*Candidate-specific probability:\*\* Not assigned/);
  assert.match(markdown, /https:\/\/www.fda.gov\/example/);
  assert.match(markdown, /not a promise of approval/);
  assert.match(markdown, /No validated candidate model/);
  assert.doesNotMatch(markdown, /Source review notes|six confirmed cases/);
  const qualified = investigationMarkdown(candidate, { ...run, id: '969d4838-430b-4a4f-b811-09323b936d6c' }, []);
  assert.match(qualified, /## Source review notes/);
  assert.match(qualified, /Editorial source check\. Astra’s output above is unchanged\./);
  assert.match(qualified, /six confirmed cases and one presumed case/);
  assert.match(qualified, /https:\/\/pmc\.ncbi\.nlm\.nih\.gov\/articles\/PMC8294837\//);
  assert.match(qualified, /Test summary\./);
  assert.doesNotMatch(qualified, /Primary corroboration of the fatal CRS event/);
  assert.doesNotMatch(investigationMarkdown(candidate, { ...run, id: 'another-unreviewed-run' }, []), /Source review notes|six confirmed cases/);
  const correctedExport = investigationMarkdown(candidate, run, [{ ...run.sources[0], publishedAt: null }]);
  assert.match(correctedExport, /Published Not disclosed;/);
  const challenge = investigationMarkdown(candidate, { ...run, previousRunId: 'previous-test-run', previousOutlook: { verdict: 'Earlier assessment', timing: 'Earlier timing' }, changes: { disposition: 'unchanged', summary: 'No supported revision', items: [{ previousClaim: 'Prior claim', currentClaim: 'Current claim', reason: 'Source supports scope only', sourceIds: ['test-source'] }] }, decisionBrief: { pivotalQuestion: 'What evidence would resolve this?', bullCase: { claim: 'Supporting case', sourceIds: ['test-source'] }, bearCase: { claim: 'Contrary case', sourceIds: ['test-source'] }, decisiveEvidence: { question: 'Is the record applicable?', whyItMatters: 'Scope determines relevance', sourceIds: ['test-source'] }, scenarios: [], diligenceQuestions: [] } }, []);
  assert.match(challenge, /## What changed/);
  assert.match(challenge, /Previous run: previous-test-run/);
  assert.match(challenge, /Earlier assessment/);
  assert.match(challenge, /Pivotal question:\*\* What evidence would resolve this/);
});
