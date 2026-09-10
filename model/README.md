# Public FDA cohort baselines

This module fits two modest statistical baselines to real FDA annual report data. It also provides source-linked examples of actual review histories for Astra to inspect. **It does not estimate a validated individual drug approval probability.**

```sh
python3 model/rebuild.py
python3 model/rebuild.py --check
python3 -m unittest discover -s model -p 'test_*.py'
```

Python standard library only. Final float outputs are serialized to twelve decimal places (at most `5e-13` absolute rounding error), which removes insignificant macOS/Linux math-library differences. Calculations retain full precision; integer counts and source hashes are unchanged. `--check` still requires an exact artifact match and reports the first differing JSON path. This is not a tolerance that silently accepts changed metrics.

To audit the upstream FDA documents, install Poppler (`pdftotext`), then run:

```sh
python3 model/verify_sources.py --download
```

Downloaded PDFs stay in ignored `research/model/.cache/`. Their SHA-256 hashes are pinned in `sources/reports.json`. Changed sources fail verification until a reviewer inspects and repins the new version. Input tables are human-transcribed rather than presented as machine-extracted or Astra-generated.

## What is predicted

| Component | Target | Unit | Method |
| --- | --- | --- | --- |
| First-cycle reference | FDA-reported annual first-cycle approval percentage | A receipt fiscal year × original application review priority | Class-specific mean, equivalent to a least-squares regression with class intercepts |
| Action timing | Action on time versus overdue by the applicable PDUFA goal | An original application or original-application resubmission with observable goal status | Beta(1,1) binomial prior plus exact FDA aggregate counts |
| Review histories | No prediction | Twelve selected approved application histories | Sourced timeline, cumulative review/sponsor months |

An FDA **action** can be an approval, complete response, tentative approval, or withdrawal. A complete response does not mean a drug will never be approved. Extensions may change the applicable goal. These targets must stay separate in the UI and in model reasoning.

## Held-out results

The model and comparison specifications are fixed in `rebuild.py`; no hyperparameter search or outcome-derived LLM features are used.

**Annual first-cycle rates:** train on the FY2013–2017 receipt cohorts as they appear in the frozen FY2019 report. Hold out FY2021–2023, labeled from the FY2025 report. A training availability bound of September 26, 2020 comes from reference 16 in [Chahal et al., JAMA Internal Medicine](https://jamanetwork.com/journals/jamainternalmedicine/fullarticle/2775955), which cites the exact FY2019 FDA report URL with that date. The current PDF metadata is May 22, 2020. This is stronger evidence than the March 2020 newsletter, which predates the current PDF version. Thus the source vintage predates the October 1, 2020 start of the first test receipt cohort.

- Class means: **6.9 percentage points MAE**.
- Pooled mean: **11.6 percentage points MAE**.
- Exactly **six held-out aggregate observations across three years**, not hundreds of individual drug predictions.
- Values are published to whole percentage points. We keep them as rates. We do **not** invent integer success counts from rounded percentages or calculate individual Brier scores from them. The artifact includes a conservative ±1 percentage point rounding envelope around MAE.

**Action timing:** train on FY2017–2019 receipt cohorts, using the FY2018–2020 report vintages. Hold out FY2022–2024. The FY2020 report PDF metadata is from August 2021; an FDA September 23, 2021 newsletter describes availability of FY2020 performance data. This precedes the October 1, 2021 start of the first test receipt cohort. Newsletter evidence supports report-era availability; an independently archived copy of each exact historical PDF byte version is not available.

| Predictor | Brier score ↓ | Log loss ↓ |
| --- | ---: | ---: |
| Class-conditioned beta-binomial | 0.03898 | 0.17771 |
| Pooled beta-binomial | **0.03832** | **0.16890** |
| Constant 90% action-goal benchmark | 0.04184 | 0.19281 |

These scores cover **603 due/resolved action outcomes**. Eight additional test records remain pending within goal. The pooled model performs slightly better on both proper scores; class conditioning has not established better individual discrimination. The 90% benchmark is a policy goal, not an empirical model of an individual application.

Scores use exact sufficient statistics: `onTime * (1-p)^2 + overdue * p^2`, divided by the due/resolved count. No pseudo-individual dataset is generated. Repeated applications, resubmissions and common sponsors cannot be deduplicated or clustered by drug because source tables are aggregate. Therefore a drug-group-separated validation claim would be false.

## Pending and source revisions

Every action cell satisfies:

`filed = onTime + overdue + pendingWithinGoal`

Even a table headed “Final” can contain pending records. For example, FY2025 report Table 5 retains four FY2024 standard NMEs/BLAs pending within goal. The pipeline keeps them pending. An action already pending *past* goal is a known missed-goal outcome; it does not imply a known drug-approval outcome.

Both fitted-probability and held-out-score sensitivity bounds consider either possible timing label for pending-within-goal records. Complete-case estimates can still be biased if the remaining cases differ systematically. Annual report revisions are preserved as distinct source vintages; training does not use revised FY2025 values in place of older training values.

## Current references and uncertainty

Current first-cycle references refit the class mean on FY2017–2023 from the FY2025 report: **78.7% priority, 57.9% standard**. The annual observed ranges are **69–89%** and **50–67%**. These are historical cohort references, not candidate-specific probabilities. Every current first-cycle reference explicitly has `candidateProbability: null`.

The current action model refits all FY2017–2024 cells. The artifact contains binomial Wilson intervals, pending-outcome sensitivity bounds, and deterministic fiscal-year-block bootstrap intervals for mean estimates. The bootstrap resamples whole fiscal years so six cells from a year move together. Only eight fiscal years are available. None of these intervals establishes coverage for an individual drug or protects against every policy/case-mix shift.

No survival curve, monthly approval CDF, or timing distribution is fabricated from FDA's median duration figures. No selected CRL dataset is used to supply a missing failure denominator. No later-reported clinical outcome, final NME designation, CRL outcome text, or LLM historical outcome memory becomes a predictive feature.

## Where Astra adds value

Astra can inspect primary evidence, distinguish an original review from a resubmission, identify an explicitly reported extension, explain which historical review paths are relevant, and identify the next decisive public event. It should expose sources and its uncertainty. The statistical reference should remain visible and reproducible.

Do not let Astra assign a numerical “adjustment” to these probabilities without a separately evaluated model. Its candidate-specific conclusion should be qualitative until a complete, timestamped application cohort and honest individual-level validation exist.

## Sourced historical pathways

`review_histories.json` contains twelve examples from FDA FY2025 Appendix A, with exact PDF page links and retained government source pages in `sources/excerpts/`. They show first-cycle approval, an extension, missed goals, complete responses and sponsor-response intervals. For instance, the RYONCIL record shows two complete responses, sponsor intervals of 28.0 and 11.2 months, and approval after 58.6 months total. All three FDA review cycles met their applicable goals.

These examples were selected to illustrate distinct paths. Because every example was approved in FY2025, their outcomes must not be pooled into a success rate. Similar review structure does not establish similarity in clinical evidence, disease, modality or manufacturing risk.

## Source files

- `sources/action_counts.json`: 48 exact count cells across six classes and eight receipt fiscal years.
- `sources/approval_rates.json`: 32 rate cells from two distinct report vintages, including explicitly flagged preliminary observations that fitting excludes.
- `sources/reports.json`: eight official FDA reports, retrieval date, data cutoff, PDF metadata and pinned source hashes.
- `artifact.json`: fitted parameters, source versions, train/test splits, observed results, uncertainty, scoring bounds and limitations.
- `review_histories.json`: selected source-linked timelines, not a training cohort.

The source verifier checks hashes, exact numerator/denominator text, and whether published chart values appear on their assigned source pages. This is a provenance check, not proof that all semantic transcriptions are correct. The first-cycle year/class positions were also visually checked on the rendered chart pages. Tests check pending exclusion, exact aggregate scoring, temporal separation, source references and artifact reproducibility.
