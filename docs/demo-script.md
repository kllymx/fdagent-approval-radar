# Approval Radar: a four-minute demo

## Before presenting

Open the workbench. Confirm that the two recorded investigations and apitegromab follow-up challenge are available. Check the live runtime's model and credentials if offering a fresh challenge. Open **Model validation** once. The evidence cutoff is September 10, 2026; recheck status before reusing the script on a later date.

All three recorded runs below actually executed with `gpt-6-astra`. Keep the **recorded** label visible and identify replays plainly. A fresh live invocation may find different evidence; show its actual progress and wait for completion before discussing its answer. The initial catalog is a curated starting packet, not a complete index of public disclosures.

## 0:00–0:30 · The diligence question

**Show the candidate list; select apitegromab.**

> “A biotech investment thesis can change when one FDA filing, trial analysis or manufacturing update changes. Approval Radar is a public-evidence workbench for investment and business-development diligence: select an application, investigate the case, challenge the conclusion and inspect its sources.
>
> “We start with nine real applications. This date is the reported FDA action target. The question is what could change the case before that decision.”

## 0:30–1:10 · Establish the initial assessment

**Open the recorded apitegromab investigation and its FDA letter citation.**

> “This is an actual recorded Astra run. Apitegromab had a manufacturing-related setback. Astra found the original FDA complete-response letter beyond our starting packet and connected it to the company's replacement-facility plan.
>
> “It concluded that an alternative site provides a credible path forward, while its good inspection history and existing inventory do not establish FDA acceptance of this product's package. It also refused to assign redacted inspection findings to particular apitegromab lots.
>
> “That identifies a specific question for diligence: what has FDA accepted about the replacement pathway?”

## 1:10–2:00 · Challenge the thesis and show the revision

**Open the recorded apitegromab challenge. Show its actual question, then the completed-site-removal finding and citation.**

> “We challenged that caution: the second site passed inspections and inventory already exists. Astra searched again. It found an August 21 release missing from the initial investigation: Catalent's removal was now completed.
>
> “It changed the wording and strengthened the mitigation assessment. The remaining uncertainty became narrower: product-specific FDA acceptance was still unconfirmed. That is a concrete revision driven by new evidence.
>
> “It also found linvoseltamab's path from a similar manufacturing setback to approval, and explained the limits: different disease, no verified shared site, and historical examples selected from successful applications. One favorable comparison cannot supply approval odds.”

**Optional live interaction:** Submit a judge's specific challenge or reuse the recorded question. Explain that this starts a new run and may differ. Continue the demo while it works; return to its actual result when complete. Do not present the recorded answer as the response to a newly submitted question.

## 2:00–2:50 · Reconcile conflicting clinical evidence

**Select deramiocel and open the recorded analysis-disagreement and cardiac-correction findings.**

> “Here the sponsor says the primary endpoint succeeded, while FDA's statistical review is unfavorable. Astra separates the analysis plans, missing-data choices and measurement scales behind those claims.
>
> “It preserves a crucial chronology: the plans changed after controlled follow-up ended, but that alone does not prove changes after unblinding. It also finds a later correction that weakened the cardiac result while leaving the reported upper-limb result unchanged.
>
> “Then it connects that evidence to the amended upper-limb indication. A reviewer can see the strongest case, the unresolved objection and the source for each.”

## 2:50–3:45 · Show the evidence for the product

**Show Model validation and the evaluation documentation.**

> “We measured two separate things. Astra answered five selected questions from original public documents, without our summaries or grading rubric. Agent review found nineteen of twenty expected distinctions, with one partially covered. The original answers and grading are public. This is a small case study, not a comparative benchmark.
>
> “The statistical module uses later years held out. Its annual first-cycle rate error was 6.9 percentage points versus 11.6 for a pooled baseline, on six aggregate observations. For action timing, the simpler pooled model performed better. We show both results and withhold unsupported individual approval probabilities.
>
> “The product opportunity is a repeatable diligence workflow: new evidence, a revised thesis, cited reasons and a clear next question. This prototype demonstrates that loop on real applications. The code, recorded runs and reproducible methods are public.”

**If a new challenge has completed, finish on one changed finding and open its source.**

## If live access is unavailable

Leave the error visible and use an explicitly labeled recorded run: “This is the actual earlier execution, with its model, time and sources preserved.” The evidence desk and historical references work without an API key.

## Supporting material

- [Actual runs, manual review and five-case evaluation](evidence-evaluation.md)
- [Criterion-level results and exact output pointers](../data/evaluation-results.json)
- [Source audit and the initial packet's coverage limitation](../data/source-audit.md)
- [Statistical methods and held-out results](../model/README.md)

Investment and business-development use is the proposed customer workflow. This prototype does not establish paying demand, investment performance, prospective clinical validity or a measured advantage over another model.
