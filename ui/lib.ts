import type { Candidate, Investigation, Source, StreamEvent } from './types';
import { getSourceReviewNotes } from '../shared/review-notes';

export function dataUrl(path: string, staticDemo: boolean, baseUrl = '/'): string {
  if (!staticDemo) return path;
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  if (path === '/api/dashboard') return `${base}demo/dashboard.json`;
  if (path.startsWith('/api/investigations/')) return `${base}demo/investigations/${path.slice('/api/investigations/'.length)}.json`;
  if (path.startsWith('/api/evidence/')) return `${base}demo/evidence/${path.slice('/api/evidence/'.length)}.json`;
  throw new Error('This action requires the local Astra research server.');
}

export function formatDate(value?: string | null, options?: Intl.DateTimeFormatOptions): string {
  if (!value) return 'Not disclosed';
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC', ...options }).format(date);
}

/** Completed episodes use their observed action; an old target never substitutes for it. */
export function candidateActionDate(candidate: Candidate): { date: string | null; label: string; shortLabel: string; completed: boolean } {
  const kind = candidate.status === 'approved' ? 'approval' : candidate.status === 'complete_response' ? 'crl' : null;
  if (!kind) return { date: candidate.targetDate, label: 'Reported FDA action target', shortLabel: 'Reported target', completed: false };
  const action = candidate.milestones
    .filter((milestone) => milestone.kind === kind && milestone.date <= candidate.asOf.slice(0, 10))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  return { date: action?.date ?? null, label: kind === 'approval' ? 'FDA approval' : 'FDA complete response', shortLabel: kind === 'approval' ? 'Approved' : 'Complete response', completed: true };
}

export function safeSourceUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

/** Later evidence layers replace earlier metadata, including an explicitly unknown date. */
export function mergeSourceRecords(...layers: Source[][]): Source[] {
  return [...new Map(layers.flat().map((source) => [source.id, source])).values()];
}

export function mergeInvestigationSources(runs: Pick<Investigation, 'createdAt' | 'sources'>[]): Source[] {
  return mergeSourceRecords(...[...runs].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((run) => run.sources));
}

export function investigationMarkdown(candidate: Candidate, investigation: Investigation, sources: Source[]): string {
  const actionDate = candidateActionDate(candidate);
  const reviewNotes = getSourceReviewNotes(investigation.id);
  const combinedSources = new Map(mergeSourceRecords(investigation.sources, sources).map((source) => [source.id, source]));
  const referencedIds = new Set([...candidate.sourceIds, ...investigation.findings.flatMap((finding) => finding.sourceIds), ...investigation.analogs.flatMap((analog) => analog.sourceIds)]);
  for (const item of investigation.changes?.items ?? []) for (const id of item.sourceIds) referencedIds.add(id);
  if (investigation.decisionBrief) {
    const brief = investigation.decisionBrief;
    for (const item of [brief.bullCase, brief.bearCase, brief.decisiveEvidence, ...brief.scenarios, ...brief.diligenceQuestions]) for (const id of item.sourceIds) referencedIds.add(id);
  }
  const sourceLine = (ids: string[]) => ids.length ? `Sources: ${ids.map((id) => {
    const source = combinedSources.get(id);
    return source && safeSourceUrl(source.url) ? `[${source.publisher} (${id})](${safeSourceUrl(source.url)})` : id;
  }).join('; ')}\n` : '';
  const lines = [
    `# ${candidate.drug}: Astra investigation`, '', candidate.indication, '',
    `- Sponsor: ${candidate.sponsor}`,
    `- Evidence as of: ${candidate.asOf}`,
    `- ${actionDate.label}: ${formatDate(actionDate.date)}${actionDate.completed ? '' : ' (not a promise of approval)'}`,
    ...(actionDate.completed && candidate.targetDate ? [`- Historical reported action target: ${formatDate(candidate.targetDate)}`] : []),
    `- Run: ${investigation.id}`,
    `- Model: ${investigation.model}`,
    `- Completed: ${investigation.createdAt}`,
    `- Provenance: ${investigation.provenance === 'recorded' ? 'Recorded Astra run' : 'Completed live Astra run'}`,
    `- Mode: ${investigation.mode}`, '',
    ...(investigation.question ? ['## Question', '', investigation.question, ''] : []),
    '## Outlook', '', investigation.outlook.verdict, '', investigation.summary, '',
    `**Timing assessment:** ${investigation.outlook.timing}`, '',
    investigation.outlook.probability === null ? '**Candidate-specific probability:** Not assigned.' : `**Astra probability estimate:** ${(investigation.outlook.probability * 100).toFixed(1)}%.`,
    investigation.outlook.probabilityBasis, '',
    ...(reviewNotes.length ? ['## Source review notes', '', 'Editorial source check. Astra’s output above is unchanged.', '', ...reviewNotes.flatMap((note) => [`### ${note.title}`, '', note.detail, '', safeSourceUrl(note.sourceUrl) ? `[${note.sourceLabel}](${safeSourceUrl(note.sourceUrl)})` : note.sourceLabel, ''])] : []),
    ...(investigation.changes ? ['## What changed', '', `Assessment: ${investigation.changes.disposition}`, '', investigation.changes.summary, '', ...investigation.changes.items.flatMap((item) => [`**Previous:** ${item.previousClaim}`, '', `**Current:** ${item.currentClaim}`, '', item.reason, '', sourceLine(item.sourceIds), ''])] : []),
    ...(investigation.previousOutlook ? ['### Previous overall outlook', '', investigation.previousOutlook.verdict, '', `**Previous timing assessment:** ${investigation.previousOutlook.timing}`, '', ...(investigation.previousRunId ? [`Previous run: ${investigation.previousRunId}`, ''] : [])] : []),
    ...(investigation.decisionBrief ? [
      '## Decision brief', '', `**Pivotal question:** ${investigation.decisionBrief.pivotalQuestion}`, '',
      '### Case for approval', '', investigation.decisionBrief.bullCase.claim, '', sourceLine(investigation.decisionBrief.bullCase.sourceIds), '',
      '### Case for a setback', '', investigation.decisionBrief.bearCase.claim, '', sourceLine(investigation.decisionBrief.bearCase.sourceIds), '',
      '### What would decide it', '', investigation.decisionBrief.decisiveEvidence.question, '', investigation.decisionBrief.decisiveEvidence.whyItMatters, '', sourceLine(investigation.decisionBrief.decisiveEvidence.sourceIds), '',
      '### Conditional scenarios', '', ...investigation.decisionBrief.scenarios.flatMap((scenario) => [`**${scenario.label}**`, '', `If: ${scenario.trigger}`, '', `Implication: ${scenario.implication}`, '', sourceLine(scenario.sourceIds), '']),
      '### Diligence questions', '', ...investigation.decisionBrief.diligenceQuestions.flatMap((item) => [item.question, '', item.whyItMatters, '', sourceLine(item.sourceIds), '']),
    ] : []),
    '## Findings', '',
    ...investigation.findings.flatMap((finding, index) => [`### ${index + 1}. ${finding.title}`, '', `Evidence direction: ${finding.direction}`, '', finding.detail, '', sourceLine(finding.sourceIds), '']),
    ...(investigation.analogs.length ? ['## Historical comparisons', '', ...investigation.analogs.flatMap((analog) => [`### ${analog.title}`, '', analog.relevance, '', `**Key difference:** ${analog.difference}`, '', sourceLine(analog.sourceIds), ''])] : []),
    '## What to watch next', '', ...investigation.nextEvidence.map((item) => `- ${item}`), '',
    '## Scope and limitations', '', ...investigation.limitations.map((item) => `- ${item}`), '',
    '## Public sources', '', ...[...referencedIds].flatMap((id) => {
      const source = combinedSources.get(id);
      if (!source) return [`- ${id}: source metadata unavailable.`];
      return [`- **${source.title}** (${id}). ${source.publisher}. Published ${formatDate(source.publishedAt)}; retrieved ${formatDate(source.retrievedAt)}. ${safeSourceUrl(source.url) ?? 'Source URL unavailable.'}`];
    }), '',
    '---', '', 'Generated by FDAgent Approval Radar. Public-source research; not an FDA determination. Historical cohort rates are distinct from Astra’s candidate assessment.', '',
  ];
  return lines.join('\n');
}

/** Incrementally decode the response, including records split across UTF-8 chunks. */
export async function readInvestigationStream(response: Response, onEvent: (event: StreamEvent) => void): Promise<void> {
  if (!response.ok || response.headers.get('content-type')?.includes('application/json')) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error?.message ?? payload?.error ?? payload?.message ?? `Request failed (${response.status}).`);
  }
  if (!response.body) throw new Error('The server returned an empty investigation response.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completed = false;
  const processLine = (line: string) => {
    if (!line.trim()) return;
    let event: StreamEvent;
    try { event = JSON.parse(line) as StreamEvent; }
    catch { throw new Error('The investigation returned an unreadable event. Please try again.'); }
    if (event.type === 'error') throw new Error(event.message);
    if (event.type === 'complete') completed = true;
    onEvent(event);
  };
  try {
    while (true) {
      const result = await reader.read();
      buffer += decoder.decode(result.value, { stream: !result.done });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) processLine(line);
      if (result.done) break;
    }
    processLine(buffer);
    if (!completed) throw new Error('The connection ended before the investigation completed. You can retry the investigation.');
  } finally {
    reader.releaseLock();
  }
}
