import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TrialEvidenceVisual, { trialAxis, trialBar } from './TrialEvidenceVisual';
import type { TrialVisual } from './types';

const base: TrialVisual = { id: 'test', title: 'Test endpoint', study: 'Test trial', endpoint: 'Test mean change', population: 'Test population', timepoint: 'Week 6', unit: 'mmHg', direction: 'lower', comparisonLabel: 'Adjusted mean change', arms: [{ label: 'Test arm A', value: -16.9, n: 100 }, { label: 'Test arm B', value: -7.9 }], effect: { label: 'Adjusted difference (mmHg)', value: -9.1, lower: -13.3, upper: -4.9, level: '95% CI' }, interpretation: 'Test interpretation, not product evidence.', limitations: ['Test limitation.'], sourceIds: ['test-source'], sourceNote: 'Test source note.' };

test('trial bars preserve a real zero baseline for positive, negative and mixed endpoints', () => {
  const negative = trialAxis([-16.9, -7.9], 'mmHg');
  assert.equal(negative.max, 0);
  assert.ok(negative.min <= -16.9);
  const bar = trialBar(-16.9, negative);
  assert.equal(bar.zero, 100);
  assert.equal(bar.start + bar.width, 100);
  assert.ok(bar.start >= 0 && bar.width <= 100);
  const positive = trialAxis([28.7, 16.3], 'months');
  assert.equal(positive.min, 0);
  assert.equal(trialBar(28.7, positive).start, 0);
  const mixed = trialAxis([-4, 3], 'points');
  assert.ok(mixed.min < 0 && mixed.max > 0);
  assert.equal(trialBar(3, mixed).start, trialBar(-4, mixed).zero);
  assert.equal(trialBar(0, mixed).width, 0);
  const zeros = trialAxis([0, 0], 'points');
  assert.ok(zeros.max > zeros.min);
  assert.ok(Number.isFinite(trialBar(0, zeros).zero));
});

test('percent charts use the whole percentage scale and never truncate signed changes to zero', () => {
  assert.deepEqual(trialAxis([49, 31.2], '%'), { min: 0, max: 100, ticks: [0, 25, 50, 75, 100] });
  assert.equal(trialBar(49, trialAxis([49, 31.2], '%')).width, 49);
  assert.ok(trialAxis([-10, 5], '%').min < 0);
});

test('trial presentation preserves adjusted effects, supplied denominators, evidence scope and CI level', () => {
  const html = renderToStaticMarkup(createElement(TrialEvidenceVisual, { visuals: [base], onSources: () => {} }));
  assert.match(html, /−16\.9 mmHg/);
  assert.match(html, /−9\.1/);
  assert.match(html, /95% CI/);
  assert.match(html, /−13\.3–−4\.9/);
  assert.match(html, /Lower is better/);
  assert.match(html, /n = 100/);
  assert.doesNotMatch(html, /n = 0|n = undefined/);
  assert.match(html, /Test population/);
  assert.match(html, /Week 6/);
  assert.match(html, /Test limitation/);
  assert.match(html, /Not approval probabilities/);
  const hr = renderToStaticMarkup(createElement(TrialEvidenceVisual, { visuals: [{ ...base, unit: 'months', arms: [{ label: 'A', value: 28.7 }, { label: 'B', value: 16.3 }], effect: { label: 'Hazard ratio', value: 0.5 } }], onSources: () => {} }));
  assert.match(hr, /Hazard ratio/);
  assert.doesNotMatch(hr, /0\.5 months/);
});
