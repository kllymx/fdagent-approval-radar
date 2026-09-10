import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import { createServer } from 'vite';
import type { Assessment, Candidate, Dashboard, TrialVisual } from './types';

const candidate = (id: string, drug: string, status: Candidate['status'] = 'under_review'): Candidate => ({
  id, drug, status, indication: `Test indication for ${drug}`, sponsor: 'Test sponsor', modality: 'Test', phase: 'Test', reviewType: 'Test', applicationType: 'Test', nctIds: [], targetDate: '2026-10-01', targetDateKind: 'reported', asOf: '2026-09-10', summary: `Review history for ${drug}`, sourceIds: [], signals: [],
  milestones: status === 'approved' ? [{ id: 'approved', date: '2026-09-03', kind: 'approval', title: 'FDA approval', detail: 'Test approval evidence', sourceIds: [] }] : [],
});
const candidates = [candidate('alpha', 'Alpha'), candidate('beta', 'Beta'), candidate('gamma', 'Gamma'), candidate('approved', 'Approved drug', 'approved')];
const assessment = (id: string, category: Assessment['category']): Assessment => ({
  candidateId: id, category, summary: `Assessment for ${id}`, pivotalQuestion: `Diligence question for ${id}`, factors: [{ category: 'clinical', state: 'mixed', rationale: `Clinical evidence for ${id}`, sourceIds: [] }], sourceIds: [], model: 'test-model', createdAt: '2026-09-10T12:00:00Z', evidenceAsOf: '2026-09-10', scope: 'initial_packet', basedOnRunId: null, inputHash: 'test', responseId: 'test',
});
const visual: TrialVisual = { id: 'alpha-first', title: 'First endpoint', study: 'Test study', endpoint: 'Test outcome', population: 'Test population', timepoint: 'Week 6', unit: '%', direction: 'higher', comparisonLabel: 'Response', arms: [{ label: 'Test arm', value: 40 }], interpretation: 'Test interpretation', limitations: [], sourceIds: [], sourceNote: 'Test source' };
const dashboard: Dashboard = {
  catalog: { schemaVersion: 1, generatedAt: '2026-09-10', asOf: '2026-09-10', candidates, sources: [], coverage: { title: 'Test coverage', description: 'Test records only', limitations: [] } },
  runtime: { configured: false, model: 'test-model', provider: 'test', status: 'unconfigured' },
  model: { status: 'unavailable', title: 'Test model', summary: 'No model', cohortSize: 0, metrics: [], limitations: [] },
  investigations: [], assessments: { alpha: assessment('alpha', 'mixed'), beta: assessment('beta', 'concerning'), gamma: assessment('gamma', 'favorable'), approved: assessment('approved', 'concerning') },
  trialVisuals: { alpha: [visual, { ...visual, id: 'alpha-second', title: 'Second endpoint' }] },
};

test('repeated candidate switches replace evidence panels, reset local controls, and never duplicate React keys', async () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/' });
  dom.window.scrollTo = () => {};
  const globals: Record<string, unknown> = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  const reactErrors: string[] = [];
  console.error = (...args: unknown[]) => { reactErrors.push(args.map(String).join(' ')); };
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url === '/api/dashboard') return Response.json(dashboard);
    if (url.startsWith('/api/evidence/')) return Response.json({ error: 'No test dossier' }, { status: 404 });
    throw new Error(`Unexpected test request: ${url}`);
  };
  // Vite transforms import.meta.env exactly as in the application; React DOM runs in memory.
  const server = await createServer({ configFile: false, root: fileURLToPath(new URL('..', import.meta.url)), server: { middlewareMode: true, watch: null }, appType: 'custom', logLevel: 'silent', optimizeDeps: { noDiscovery: true } });
  const { createRoot } = await import('react-dom/client');
  const container = dom.window.document.getElementById('root')!;
  const root = createRoot(container);
  try {
    const { default: App } = await server.ssrLoadModule('/ui/App.tsx');
    await act(async () => { root.render(createElement(App)); });
    const cases = [
      { drug: 'Alpha', verdict: 'Mixed case', id: 'alpha' },
      { drug: 'Beta', verdict: 'Material concerns', id: 'beta' },
      { drug: 'Approved drug', verdict: 'FDA approved', id: 'approved' },
      { drug: 'Gamma', verdict: 'Favorable case', id: 'gamma' },
    ];
    for (let cycle = 0; cycle < 3; cycle++) {
      for (const item of cases) {
        const button = [...container.querySelectorAll<HTMLButtonElement>('.candidate-list button')].find((element) => element.querySelector('strong')?.textContent === item.drug);
        assert.ok(button, `Sidebar contains ${item.drug}`);
        await act(async () => { button.click(); });
        assert.equal(container.querySelector('.candidate-title-line h1')?.textContent, item.drug);
        assert.equal(container.querySelectorAll('.candidate-assessment').length, 1, `Only ${item.drug}'s assessment is mounted after switch ${cycle}`);
        assert.equal(container.querySelector('.assessment-verdict')?.textContent, item.verdict);
        assert.equal(container.querySelectorAll('.supporting-evidence').length, 1);
        assert.equal(container.querySelectorAll('.assessment-factor-detail').length, 0);
        assert.equal(container.querySelectorAll('.supporting-section[open]').length, 0);
        if (item.id !== 'approved') assert.equal(container.querySelector('.assessment-summary')?.textContent, `Assessment for ${item.id}`);
        if (item.id === 'alpha') {
          await act(async () => { container.querySelector<HTMLButtonElement>('.assessment-factor')!.click(); });
          assert.match(container.querySelector('.assessment-factor-detail')!.textContent!, /Clinical evidence for alpha/);
          const clinicalResults = container.querySelector<HTMLDetailsElement>('.trial-evidence')!;
          clinicalResults.open = true;
          assert.equal(container.querySelector('.trial-visual h3')?.textContent, 'First endpoint');
          const selector = container.querySelector<HTMLSelectElement>('[aria-label="Clinical result"]')!;
          await act(async () => { selector.value = 'alpha-second'; selector.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
          assert.equal(container.querySelector('.trial-visual h3')?.textContent, 'Second endpoint');
          assert.equal(container.querySelectorAll('.trial-visual').length, 1);
        }
      }
    }
    assert.equal(container.querySelectorAll('.candidate-list button').length, 4);
    assert.deepEqual(reactErrors, [], 'Navigation emits no React errors or duplicate-key warnings');
  } finally {
    await act(async () => { root.unmount(); });
    await server.close();
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    dom.window.close();
  }
});
