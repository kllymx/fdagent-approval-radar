# Trial visual data: sources and review

`trial-visuals.json` contains nine manually curated chart records for six real drug–indication episodes, checked September 10, 2026. These are reported trial results, not Astra-generated measurements, approval forecasts or reconstructed patient data. Astra's recorded investigations supplied several source-discovery paths; a separate research agent checked the chart values against the original documents or trial-registry results.

## What was checked

Each comparison retains its trial, population, endpoint, timepoint, units and source IDs. All IDs resolve to the candidate's catalog sources or a public recorded investigation. Numerical checks cover arm order, effect estimates, interval bounds and confidence level. Sample sizes appear only where the source gives the relevant arm denominator. The review does not establish the ultimate clinical interpretation or completeness of the evidence.

| Candidate / visual | Source and checked values | Important boundary |
|---|---|---|
| Lorundrostat / Launch-HTN office BP | [JAMA primary results and Table 2](https://pmc.ncbi.nlm.nih.gov/articles/PMC12210145/): −16.9 versus −7.9 mmHg; n=808/270; modeled difference −9.1, 95% CI −13.3 to −4.9. | Week-six pooled 50 mg analysis, distinct from total randomized enrollment and later dose escalation. |
| Lorundrostat / Advance-HTN potassium | [NEJM abstract](https://www.nejm.org/doi/abs/10.1056/NEJMoa2501440): 5%, 7%, 0%; n=94/96/95; reported events 5/7/0. | Laboratory potassium >6.0 mmol/L, not a serious-event or discontinuation rate. Escalation to 100 mg was conditional. |
| Satralizumab / SatraGO-1 | [Registry primary outcome](https://clinicaltrials.gov/study/NCT05987423): 49.0%/31.2%; n=50/51; difference 17.9 percentage points, 95.03% CI −1.6 to 37.3; p=0.0715. | Active TED only; the primary endpoint failed. |
| Satralizumab / SatraGO-2 | [Registry primary outcome](https://clinicaltrials.gov/study/NCT06106828): 52.9%/23.4%; n=48/49; difference 28.9 points, 95.03% CI 11.5 to 46.2; p=0.0011. | Active TED only; a distinct successful trial, not a pooled estimate. |
| Zanzalintinib / ITT overall survival | [Lancet abstract](https://pubmed.ncbi.nlm.nih.gov/41130252/): medians 10.9/9.4 months; n=451/450; HR 0.80, 95% CI 0.69–0.93; p=0.0045. | April 30, 2025 cutoff, combination regimen, molecular exclusions. |
| Zanzalintinib / final NLM survival | [June 22, 2026 sponsor release](https://ir.exelixis.com/news-releases/news-release-details/exelixis-provides-update-phase-3-stellar-303-trial-evaluating): medians 15.9/12.7 months; HR 0.83, 95% CI 0.66–1.05; p=0.1185. | Final analysis, not the older interim HR. Arm n omitted because not established in this release. |
| Bezuclastinib / PEAK PFS | [May 28 sponsor release](https://www.globenewswire.com/news-release/2026/05/28/3302753/0/en/cogent-biosciences-announces-fda-acceptance-of-new-drug-application-nda-with-priority-review-for-bezuclastinib-in-combination-with-sunitinib-for-patients-with-gist.html): central-review medians 16.5/9.2 months; HR 0.50, 95% CI 0.39–0.65. | Combination versus sunitinib after imatinib; overall survival immature. |
| Giredestrant / lidERA three-year iDFS | [June 2 sponsor release](https://www.roche.com/media/releases/med-cor-2026-06-02): 92.4%/89.6%; HR 0.70, 95% CI 0.57–0.87; p=0.0014. | Survival estimates, not crude proportions. Medium/high-risk ER+/HER2− early breast cancer; primary endpoint excludes second primary non-breast cancers. |
| Atezolizumab / ATOMIC 36-month DFS | [June 11 sponsor release](https://www.roche.com/media/releases/med-cor-2026-06-11): rounded estimates 86%/76%. | dMMR stage III colon cancer; combination followed by atezolizumab maintenance versus six months of FOLFOX6. |

## Interpretation safeguards

- Satralizumab's [September 7 primary paper](https://www.sciencedirect.com/science/article/pii/S0161642026006731) specifies multiple imputation and stratified Mantel–Haenszel differences. Percentages and n must not be converted into invented responder counts. The 95.03% interval level is intentional. SatraGO-1's failed primary endpoint makes its hierarchical secondary tests descriptive.
- Zanzalintinib's historical [design publication](https://pmc.ncbi.nlm.nih.gov/articles/PMC11485978/) differs from later dual-primary descriptions. The operative amended SAP remains unavailable; the older plan alone cannot invalidate the reported ITT result. NLM means no active liver metastases at baseline, not no previous liver metastases.
- Hazard ratios are separate effect statistics, with no months or percentage units. Their confidence intervals are not intervals around the plotted medians or timepoint estimates. No survival trajectory has been constructed.
- Absolute differences of 2.8 percentage points for lidERA and 10 points for ATOMIC are arithmetic on the displayed estimates. Neither is a relative hazard reduction; ATOMIC retains the source's whole-percent rounding.
- Lower values are directionally preferable for BP change and potassium-event frequency; higher values are preferable for the displayed response/survival endpoints. These directions do not establish net benefit, approval prospects or comparisons across different drugs and trials.

## Scope and maintenance

The JSON is an evidence-date snapshot. It does not claim that older releases are the latest available trial analyses. Several sponsor sources now have richer data than the initial catalog summaries; the charts retain those source links without silently upgrading a separate model assessment. The full JAMA extraction, NEJM abstract, sponsor disclosures and registry snapshots were inspected in the ignored public-source cache. No raw publisher text is redistributed here. When adding a chart, preserve the same endpoint-specific denominator and uncertainty checks rather than filling missing values from enrollment metadata.
