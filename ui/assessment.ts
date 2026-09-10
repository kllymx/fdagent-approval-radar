import type { Assessment, Candidate } from './types';

export type OutlookCategory = Assessment['category'] | 'not_assessed' | 'approved' | 'complete_response';
export const OUTLOOK_LABELS: Record<OutlookCategory, string> = {
  favorable: 'Favorable', mixed: 'Mixed', concerning: 'Concerning', insufficient: 'Insufficient evidence',
  not_assessed: 'Not assessed', approved: 'FDA approved', complete_response: 'Complete response',
};
export const OUTLOOK_ORDER: OutlookCategory[] = ['favorable', 'mixed', 'concerning', 'insufficient', 'not_assessed', 'approved', 'complete_response'];

export function candidateOutlook(candidate: Candidate, assessment?: Assessment): OutlookCategory {
  if (candidate.status === 'approved' || candidate.status === 'complete_response') return candidate.status;
  return assessment?.category ?? 'not_assessed';
}

export function outlookCounts(candidates: Candidate[], assessments: Record<string, Assessment> = {}): Record<OutlookCategory, number> {
  const counts = Object.fromEntries(OUTLOOK_ORDER.map((category) => [category, 0])) as Record<OutlookCategory, number>;
  for (const candidate of candidates) counts[candidateOutlook(candidate, assessments[candidate.id])] += 1;
  return counts;
}
