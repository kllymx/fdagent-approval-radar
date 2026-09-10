# Evidence evaluation

Three live Astra runs, including a follow-up challenge, were checked against their cited public sources by a separate research agent. No material factual error was found in the consequential claims examined. This is a bounded source review by a separate research agent, not clinical expert sign-off, an exhaustive audit or an estimate of future predictive accuracy.

## What ran

| Candidate | Actual run ID | Model | Run started, UTC | Recorded duration |
| --- | --- | --- | --- | --- |
| Apitegromab / SMA | `1086eb94-24fd-4b75-94ef-f1f8ac2227ff` | `gpt-6-astra` | September 10, 2026, 17:42:05 | 85.696 seconds |
| Deramiocel / DMD | `dbaf1062-0418-4997-ba97-2a5935a19c55` | `gpt-6-astra` | September 10, 2026, 17:42:03 | 118.397 seconds |
| Apitegromab challenge | `d293d1fd-2e27-4a09-93d6-8666ad6911e3` | `gpt-6-astra` | September 10, 2026, 17:52:01 | 124.193 seconds |

These were real API executions with source-reading and search tools. Their stored findings and outlooks are the actual generated answers. They are labeled **recorded** when replayed publicly. Preparation of a public copy may sanitize source metadata that originally contained excessive verbatim search excerpts; that is distinct from changing the answer. Original runtime records remain outside version control.

All three runs withheld numerical candidate probabilities. The model's qualitative verdicts are judgments that can later prove wrong; accurate citation and reasoning boundaries do not validate their future outcomes.

## Independent review procedure

1. Read the completed answer without editing it. Identify consequential dates, trial numbers, application identifiers, facility statements, regulatory conclusions and probability claims.
2. Resolve the cited source IDs. Read the original primary source or independently fetch the public API record. Use cached raw text to compare passages when the same page blocks direct HTTPS.
3. Separate source-authored facts from model interpretation. Check whether sponsor statements remain attributed, missing evidence stays unknown, and a current registry is distinguished from historical prespecification.
4. Check the analysis population, endpoint, scale and statistical-plan version whenever two numbers appear to conflict. Verify whether a purported FDA conclusion predates a later amendment.
5. Compare quoted statistical reference counts with the reproducible model artifact. Reject any implication that action timing equals approval or that an original-application baseline validates a resubmission probability.
6. Record findings and unresolved verification limits. Do not silently fix the generated answer or score unstated facts as established truth.

This review prioritized the claims that could materially change a regulatory reader's interpretation. It did not independently reproduce participant-level analyses, obtain unpublished submissions, check every sentence, or re-run clinical trials.

## Case findings

### Apitegromab: facility mitigation without manufactured certainty

The model found the FDA complete-response record for BLA 761463 through a live API search, adding evidence beyond the original catalog. The review independently confirmed the letter date and its manufacturing conditions, potential additional inspection, requested labeling and safety updates, and conditional pregnancy-safety study requirement. The answer did not turn those requests into invented observed harm.

The model reconciled that record with Scholar Rock's newer second-facility pathway. It preserved the distinction between available inventory, reported general inspection history, and FDA acceptance of the candidate-specific package. It correctly declined to assign redacted Form 483 product or lot information to apitegromab.

The SAPPHIRE numerical findings matched the sponsor's source, with combined-dose and individual-dose analyses kept separate. The registry corroborates study design and enrollment; it does not independently validate the sponsor's efficacy numbers. The model explicitly acknowledged that limitation.

**Remaining limit:** Current FDA acceptance of the unnamed replacement site and complete product-quality package was not established. A constructive qualitative outlook is therefore an interpretation, not verified readiness.

Sources: [FDA complete-response API](https://api.fda.gov/transparency/crl.json?limit=6&search=company_name%3A%22Scholar%20Rock%22), [August facility update](https://investors.scholarrock.com/news-releases/news-release-details/scholar-rock-announces-fda-review-apitegromab-biologics-license), [FDA Catalent Form 483](https://www.fda.gov/media/193455/download), [SAPPHIRE disclosure](https://investors.scholarrock.com/news-releases/news-release-details/scholar-rock-presents-new-phase-3-sapphire-data-2025-muscular/).

### Deramiocel: analytical disagreement and a later amendment

The run retrieved FDA's meeting presentation and Capricor's August 13 update beyond the initial catalog. The primary analysis figures, their distinct scales, the additional sensitivity variants and the reported later cardiac correction were checked against those documents.

The answer accurately preserved the study-completion, analysis-plan and formal-unblinding sequence. It did not equate changes after completed follow-up with proven changes after unblinding. It also preserved the difference between a potential functional-unblinding risk and evidence that blinding actually failed.

The answer linked the newer upper-limb-focused request to the relevant outcome, while explaining why that change does not automatically dispose of FDA's earlier statistical concerns. It distinguished open-label second-year follow-up from a second randomized year and separated sponsor-reported committee discussion from independently verified minutes.

**Remaining limit:** The full August amendment, patient-level data, complete statistical audit trail and post-amendment FDA review were not available. The model's guarded conclusion is not a final agency finding on the amended indication.

Sources: [FDA briefing, especially printed pages 32–34, 47 and 52](https://www.fda.gov/media/193839/download), [FDA meeting presentation](https://www.fda.gov/media/193912/download), [Capricor August 13 update](https://www.capricor.com/investors/news-events/press-releases/detail/353/capricor-therapeutics-reports-second-quarter-2026-financial), [Capricor August 24 amendment update](https://www.capricor.com/investors/news-events/press-releases/detail/354/capricor-therapeutics-announces-extension-of-pdufa-target).

### Apitegromab challenge: new evidence changes the assessment

A follow-up challenge asked whether successful inspections and available inventory should change the earlier conclusion. Live research found an additional August 21 disclosure reporting completed removal of Catalent from the BLA. That source was absent from the original packet and first investigation. Astra explicitly updated the earlier prospective wording and gave the mitigation more weight while preserving the distinction between completed site removal and undisclosed FDA acceptance of the replacement package. The review verified the release on both the sponsor site and Business Wire.

Astra also found linvoseltamab's path from a third-party fill-finish CRL to resubmission and FDA approval. The dates and FDA-reported review durations checked out. The answer acknowledged different clinical context, an unverified shared-facility relationship and selection of historical examples from approved applications. It used the comparison to explain a possible pathway, not to calculate approval odds.

This is one observed example of evidence-responsive revision. It does not establish reliability across arbitrary challenges. See the [August 21 sponsor update](https://investors.scholarrock.com/news-releases/news-release-details/scholar-rock-provides-update-global-apitegromab-regulatory), [FDA approval of linvoseltamab](https://www.fda.gov/drugs/resources-information-approved-drugs/fda-grants-accelerated-approval-linvoseltamab-gcpt-relapsed-or-refractory-multiple-myeloma), and [recorded challenge](../data/investigations/d293d1fd-2e27-4a09-93d6-8666ad6911e3.json).

The more detailed claim checks are in [recorded-run-review.md](../data/recorded-run-review.md).

## Expanded decision-brief investigations

The later satralizumab run (`88baf4b3-0ec3-4dd4-b344-34a8b1e170ab`) inspected both pivotal registry result records and a September 7 results publication. Independent project-agent review verified the primary estimates, stopped fixed-sequence testing in SatraGO-1, continuous proptosis/diplopia differences, safety counts and the distinction between a manufacturing supplement for an existing product and TED approval. Its specific diligence questions concern the locked analysis plan, robustness, label population and FDA feedback. The answer remains unchanged in the recorded artifact; this is bounded factual review, not external expert validation.

The further apitegromab challenge (`fd8efe13-d17e-47d4-8245-867f37157055`) exercised the existing FDAgent MCP data connection. It distinguished a BIMO research inspection from CGMP manufacturing acceptance and returned an accurate **unchanged** comparison with the previous report. The private compliance dataset is not redistributed. Nonlinked records remain research leads and the report identifies the original-source gap.

See the [review log](../data/recorded-run-review.md) for scope and an incomplete zanzalintinib-attempt disclosure. Completed-run metrics exclude unsuccessful attempts and are not total experiment cost. These new examples do not change the five-case rubric score below.

## Five completed document-only cases

Astra answered all five questions in [evaluation-cases.json](../data/evaluation-cases.json) using the selected original public documents. A separate research agent manually graded the answers against the twenty previously authored expected distinctions: **19 met, one partially met, none absent or contradicted**. None of the fourteen listed critical overclaims was observed. These are coverage counts for this small selected suite, not a representative accuracy estimate or validation of approval forecasts.

The grading was performed by the same project research agent that authored the rubric, with the answering model's identity visible. It was not blinded grading or independent human clinical/statistical expert review. [evaluation-results.json](../data/evaluation-results.json) records every criterion, exact answer excerpts with JSON pointers, source/input hashes, model, timestamps, usage, limitations and the incomplete-attempt disclosure. The model-generated answers remain unchanged in [evaluation-runs](../data/evaluation-runs).

| Case and original output | Criteria met | Partial | Consequential distinction |
| --- | ---: | ---: | --- |
| [Relutrigine inspection scope](../data/evaluation-runs/bimo-manufacturing-scope.json) | 4 | 0 | A clean sponsor BIMO inspection does not establish manufacturing-site or CMC clearance. |
| [Deramiocel analysis chronology](../data/evaluation-runs/deramiocel-analysis-chronology.json) | 3 | 1 | Changes after controlled follow-up are distinct from changes after formal unblinding; the later indication amendment does not erase the PUL analysis concerns. |
| [D-PLEX100 endpoint/population](../data/evaluation-runs/dplex-endpoint-population.json) | 4 | 0 | Primary composite n=798, evaluable SSI-only n=768, and randomized n=975 are different populations. |
| [Relutrigine target revision](../data/evaluation-runs/relutrigine-target-revision.json) | 4 | 0 | December 27 supersedes September 27; a changed target alone cannot establish approval odds. |
| [Apitegromab facility mitigation](../data/evaluation-runs/apitegromab-facility-mitigation.json) | 4 | 0 | The August 7 release describes planned removal and ongoing second-site review, with neither automatic clearance nor inevitable rejection. |

**The partial criterion:** The deramiocel answer correctly reproduces FDA Tables 7 and 9, including PUL p=0.24 versus the applicant's CSR-modified p=0.029, SAP 3.0 p=0.045, differing scales, and sensitivity to missing-data assumptions. It does not state the rubric's specific Appendix Table 12 SAP 1.1 p=0.11 comparison. Table 7 itself distinguishes p=0.24 without the later imputation from p=0.11 with it. This omission reduces rubric coverage; it is not a false claim that those analyses are identical. No rubric was revised to award full credit after seeing the answer.

Two useful additional observations were checked. The D-PLEX100 answer detects that the registry labels a negative difference as a “Risk Ratio,” and correctly keeps the reported label separate from the difference implied by the rates. The apitegromab answer flags June/October date references inside text extracted from an April Form 483. Those references occur in the actual supplied text; whether they reflect source or extraction errors remains unverified. The answer appropriately avoids relying on them to establish event timing.

### Inputs and execution

Inspection of [scripts/evaluate.ts](../scripts/evaluate.ts) confirmed that the model received only the case ID, question, cutoff and extracted source text with IDs, titles and URLs. Candidate summaries, curated signal labels, expected facts and critical-overclaim lists were excluded. The questions and document selection still steer the task toward known issues; the experiment does not demonstrate autonomous discovery of those issues across the full web. Separate live investigations above do exercise source search and retrieval.

All completed responses report `gpt-6-astra` with high reasoning effort. The harness checks structured output and permitted source IDs; those checks do not establish factual correctness. The manual source review supplies the semantic assessment. No comparison model or summary-only ablation ran.

| Case | Completion time, UTC on September 10, 2026 | Recorded duration | Input / output tokens |
| --- | --- | ---: | ---: |
| BIMO scope | 17:48:37 | 32.305 s | 6,427 / 1,398 |
| D-PLEX100 | 17:49:45 | 68.089 s | 34,949 / 2,911 |
| Relutrigine date | 17:51:54 | 23.560 s | 7,936 / 1,087 |
| Apitegromab | 17:52:42 | 48.508 s | 23,566 / 2,194 |
| Deramiocel | 17:52:56 | 86.284 s | 48,268 / 3,815 |

The first deramiocel attempt was incomplete at an output cap of 4,500 tokens. The coordinator increased the cap to 12,000 for the remaining cases, including that retry. BIMO and D-PLEX100 had completed under the original cap and were retained. The initial harness threw before preserving the incomplete response, so its exact failure detail, output, usage and latency cannot be independently audited. The table covers completed responses only; it is not total experiment latency or cost. No completed answer was discarded to select a better one.

Document SHA-256 hashes identify the exact extracted text supplied. The input hash covers the complete serialized question/document payload. Public records contain original AI answers and source metadata, while full retrieved documents stay in ignored local caches. Later readers can inspect the cited public sources, but a changed webpage may not reproduce the recorded hash.

A future comparative study needs an independent question set, identical evidence and budgets, blinded expert grading, all failed attempts retained, and prospective evaluation. Even complete coverage of this suite would not validate individual-drug approval probabilities.

## Statistical model evaluation is separate

The historical module evaluates aggregate FDA cohort baselines with later receipt years held out. The first-cycle model predicts annual rates, while the timing model predicts action-by-goal outcomes. These metrics are independent of the manual Astra reviews:

- First-cycle annual-rate MAE: **6.9 percentage points** for review-class means versus **11.6** for a pooled mean, over **six aggregate observations** from FY2021–2023.
- Action-timing Brier score: **0.03832 pooled**, **0.03898 by class**, **0.04184 constant-90% benchmark**, over **603 due/resolved outcomes** from FY2022–2024; eight further records remain pending within goal.

The pooled timing baseline performs slightly better than class conditioning. Outcomes are counted from aggregate official tables; individual drugs cannot be deduplicated or grouped across the source cells. These are not 603 individual approval predictions. See [the model methodology](../model/README.md) for source vintages, temporal separation, pending-outcome sensitivity and limitations.
