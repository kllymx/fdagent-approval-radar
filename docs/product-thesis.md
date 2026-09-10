# Product thesis: regulatory diligence that can change its mind

**Proposed initial customer:** life-sciences investors and business-development analysts evaluating a clinical asset or monitoring a portfolio. This is a customer hypothesis to test, not evidence of demand or paid adoption.

Their immediate question is often specific: “Does the new disclosure change the regulatory case, and which assumption should we investigate next?” An approval calendar supplies a date. A useful diligence tool must explain the evidence supporting the outlook, the strongest contrary interpretation and what has changed since the last assessment.

## The headline and the decision behind it

The primary headline is **Astra's approval outlook**, expressed as a qualitative case with a sourced explanation. The adjacent date is the **reported FDA action target**, not a predicted approval date. The first screen should answer three questions in order: how strong is the current case, what could change it, and when is the next reported FDA decision target?

| Initial user | Decision they face | What they should leave with |
|---|---|---|
| Biotech investment analyst | Which upcoming review needs deeper diligence before an investment committee meeting? | The strongest supporting evidence, material objection, unresolved assumption and a cited brief. |
| Pharma business-development team | What evidence should we request before advancing a licensing discussion? | Specific questions about the study, safety profile, manufacturing package and regulatory correspondence. |
| Portfolio research team | Does a new disclosure change the thesis on an asset we already follow? | A comparison of the old and new claims, the source that changed the view, and what remains unresolved. |

These are proposed users and workflows, not validated customer demand. The product should make the assessment prominent and the supporting detail progressively available: open the reasoning, inspect a domain, then inspect the relevant chart or source. A wall of statistics makes the analyst perform the synthesis again.

An individual “chance of approval this year” would be useful only after validating its outcome definition, evidence cutoff and calibration. The current evidence does not support that number. An FDA action may also be a complete response rather than approval. A prominent percentage today would obscure the part the prototype actually demonstrates: Astra can retrieve evidence, reconcile materially different interpretations and explain whether a new fact warrants revising a view.

The action is **explore and challenge the reasoning**, then export the resulting diligence brief. Charts support that decision; they are not the product's main result. A useful demonstration ends with a better question to ask management or an explicit thesis change, rather than a tour of dashboard panels.

## The demonstrated workflow

The apitegromab investigation started with a manufacturing-related CRL and a disclosed plan to replace a fill-finish site. In response to a challenge, Astra found a later release stating that removal of the old site was completed. It revised the factual premise, assigned the favorable evidence more weight and retained the distinction between that progress and FDA acceptance of the product-specific replacement package.

That is an inspectable sequence: **initial thesis → new evidence → explicit revision → remaining diligence questions.** It offers a concrete way to test value with analysts: compare their existing workflow with a reviewable evidence packet and measure time to a defensible answer, missed material evidence, citation errors and whether the output changes their next diligence question.

## What the expanded prototype makes useful

The overview covers 33 drug–indication episodes, with source and company filters. Every candidate has a recorded scan across four public database families; the evidence map retains scope and missingness. This makes the workflow usable across a watchlist rather than only two demonstration assets.

The new decision brief is structured around an actual decision: the pivotal assumption, the strongest competing interpretations, evidence that would distinguish them, conditional paths and specific diligence questions. Satralizumab demonstrates clinical interpretation across two studies and a testing hierarchy. Apitegromab demonstrates product–facility and inspection-scope reasoning through the existing FDAgent MCP installation. The latter challenge correctly keeps its outlook unchanged. Export carries these details and citations into an analyst's existing workflow.

The value proposition is reducing the work between a disclosure and an accountable diligence question. Source aggregation alone is replaceable. The harder behavior is preserving population, endpoint, timing and authority distinctions while showing exactly what changed. These examples demonstrate that behavior on selected cases; customer interviews and observed workflows must establish whether it is sufficiently reliable and valuable to buy.

## Why the model belongs in the product

Astra reads and reconciles messy documents; a separate reproducible statistical model supplies historical context. Keeping those functions distinct makes disagreements visible and avoids presenting prose confidence as a calibrated forecast. The current baseline is deliberately limited to reported cohort outcomes. A future individual model requires much better application-cycle data and prospective validation.

The durable product opportunity would be a maintained, dated history of drug–indication–application–facility relationships and thesis changes. Each link needs provenance and review. The hackathon prototype implements source discovery, cited decision briefs and explicit challenge comparisons. The next useful expansion would be a maintained application-cycle dataset and source-change detection that proposes a new investigation when a material disclosure appears. Automated alerts, analyst collaboration, comprehensive coverage and validated candidate probabilities remain future work.

## Next customer experiment

Recruit a small set of biotech investors and licensing teams. Ask each to bring one active public-data diligence question. Observe whether the workbench produces a material, correctly sourced distinction they missed or gets them to a useful follow-up faster. Do not treat positive reactions to the demo as proof of willingness to pay. A team subscription for recurring portfolio diligence is a plausible commercial model to test after that workflow proves valuable.

## What the hackathon proves

- Astra performed real tool-directed public research and handled competing statistical interpretations.
- A real challenge led to a sourced factual update without an unsupported reversal.
- Historical modeling is reproducible, with held-out results and a stronger pooled baseline shown where it wins.
- The code, reviewed reports, source references and evaluation notes are public and inspectable.

It does not prove investment returns, broad benchmark superiority, clinical correctness across all cases or the ability to predict an individual FDA decision.
