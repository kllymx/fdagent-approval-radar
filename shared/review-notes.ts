/** Editorial source checks; kept separate from unchanged recorded Astra output. */
export interface SourceReviewNote {
  title: string;
  detail: string;
  sourceUrl: string;
  sourceLabel: string;
}

const notesByRun: Record<string, readonly SourceReviewNote[]> = {
  '969d4838-430b-4a4f-b811-09323b936d6c': [{
    title: 'Rejection confirmation in the Highdes study',
    detail: 'The report follows the abstract in calling all seven early antibody-mediated rejection cases biopsy-proven. The detailed results specify six confirmed cases and one presumed case. The total remains 7 of 18 (38.9%); biopsy confirmation should not be attributed to all seven.',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8294837/',
    sourceLabel: 'Highdes study, detailed results',
  }],
  'cd2b165e-46db-45ab-b777-e89edaf5016b': [{
    title: 'Primary corroboration of the fatal CRS event',
    detail: 'The report found fatal cytokine release syndrome in secondary coverage. Arcellx’s full FY2024 SEC filing also documents one grade-5 CRS event and three deaths with treatment-emergent adverse events among 117 patients. The filing describes those events as related or unrelated to anito-cel; it does not establish that treatment caused all three deaths. This primary disclosure was missed in the retrieved excerpts.',
    sourceUrl: 'https://www.sec.gov/Archives/edgar/data/1786205/000095017025029150/aclx-20241231.htm',
    sourceLabel: 'Arcellx FY2024 Form 10-K',
  }],
};

export function getSourceReviewNotes(runId: string): readonly SourceReviewNote[] {
  return Object.hasOwn(notesByRun, runId) ? notesByRun[runId] : [];
}
