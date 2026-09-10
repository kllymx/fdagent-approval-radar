# Public-source audit — September 10, 2026

This is a focused manually curated evidence snapshot for nine real review episodes. The catalog contains no numerical approval probabilities, no fictional records and no private FDAgent material. Every timeline event and qualitative signal references a source. No claim here is an Astra prediction.

## Coverage and verified action targets

| Candidate / application scope | Latest reported FDA action target | Most recent application-status disclosure used |
| --- | --- | --- |
| Relutrigine / SCN2A and SCN8A DEEs | December 27, 2026 | Praxis SEC-filed August 6 update |
| Apitegromab / SMA | September 30, 2026 | Scholar Rock August 7 facility-pathway update |
| UX111 / MPS IIIA | September 19, 2026 | Ultragenyx August 4 update |
| Deramiocel / refined proposed upper-limb DMD indication | November 22, 2026 | Capricor August 24 major-amendment update |
| Ivonescimab plus chemotherapy / EGFR-mutated NSCLC after third-generation TKI | November 14, 2026 | Summit August 25 HARMONi update |
| Molgramostim / autoimmune PAP | November 22, 2026 | Savara August 11 update |
| Neladalkib / TKI-pretreated ALK-positive NSCLC | November 27, 2026 | GSK July 28 portfolio update; exact date in Nuvalent May 27 acceptance |
| D-PLEX100 / colorectal surgical-site infection prevention | November 28, 2026 | PolyPid August 12 update reporting July 27 acceptance |
| Floretyrosine F 18 (TLX101-Px) / glioma PET imaging | September 11, 2026 | Telix August 19 half-year update |

The `under_review` field means latest identified public reports describe ongoing review and the research did not locate a subsequent action as of the cutoff. It does not mean an FDA live pending-application database independently confirmed every episode on September 10. A future target does not exclude early FDA action. Recheck status before relying on the app after this snapshot.

## Evidence quality and meaningful distinctions

- **Relutrigine:** The March action target is superseded by the June 29 extension, reaffirmed August 6. The reported inspection was BIMO sponsor oversight, not manufacturing-site clearance. The no-concern statements are bounded sponsor accounts of specific FDA interactions. The sponsor also said it would cease providing regulatory updates before the expected targets; silence is especially uninformative.
- **Apitegromab:** The 2025 CRL announcement is dated September 23, not the September 22 original target. The August 7 source explicitly links this candidate to Catalent Indiana and says FDA review proceeds with another site. The April 24 Form 483 supports the facility facts but has redacted products; it does not identify apitegromab lots. Exact public posting date of the 483 was not established. The phase 3 source is dated March 16, 2025, and separates combined-dose and 20 mg/kg-only analyses.
- **UX111:** The current application seeks accelerated approval after a CMC-related prior CRL. It must not inherit outcomes from Ultragenyx's separate DTX401 program. The August earnings source is dated August 4. The current registry was updated August 21 and provides a different timestamp from cached search snippets.
- **Deramiocel:** FDA BLA 125842 briefing for July 29 concerns the then-proposed cardiomyopathy indication. Printed pages 32–34 give the study/analysis-plan sequence; page 52 Table 12 shows differing analysis results; page 47 gives the reviewers' unfavorable assessment. Study completion on June 18 preceded SAP 2.0 on September 26 and SAP 3.0 on November 24, 2025. Database lock/unblinding is listed November 25. “After study completion” must not be embellished into “after unblinding.” The August 24 source proposes a refined upper-limb focus with open-label follow-up. Neither document proves the final disposition of that amendment. Briefing publication day was not established; the meeting date is not silently used as first-public availability.
- **Ivonescimab:** The relevant global study is HARMONi, NCT06396065. Similarly named HARMONi-A, -2 and -6 have different populations. PFS improvement and non-significant primary OS findings must be separated. September 15's announced presentation is a future event at the cutoff; its promised content is not an observed result.
- **Molgramostim:** The extension source's own date is April 15, 2026, even though a much later target can look unusual. The August 11 disclosure reaffirms November 22. No concerns cited in a notice does not certify final readiness.
- **Neladalkib:** GSK completed the Nuvalent acquisition on July 15. Current sponsorship is shown as Nuvalent / GSK with GSK ticker; obsolete independent NUVL assumptions are avoided. Zidesamtinib already received FDA approval in July despite old September calendars and was deliberately excluded from pending candidates. The application uses a single-arm phase 1/2 program; broad registry enrollment is not the pivotal analysis sample.
- **D-PLEX100:** Registered primary analysis uses a composite including SSI, re-intervention and death in the subgroup with incision length greater than 20 cm. This is not automatically the same as sponsor-reported SSI risk reduction across a broader population. Q1 2027 was earlier sponsor timing guidance, not an FDA-assigned exact date.
- **TLX101-Px:** This is a diagnostic tracer; TLX101-Tx is a different therapy. No NCT identifier was invented to fill the schema. The submitted diagnostic package is explicitly incomplete in this collection.

## Retrieval and reproducibility

Source discovery used web search, direct primary-source reading, Firecrawl extraction when sites were blocked, and ClinicalTrials.gov v2 JSON. The actual source URLs, publication dates where established, retrieval timestamp, summaries and short excerpts are in `catalog.json`. No complete sponsor articles are checked in. SEC-filed exhibits and registry submissions are still attributed to the sponsor/responsible party, not reclassified as FDA conclusions.

`source-health.json` records the reproducible refresh outcome per URL, including direct-HTTP failures and optional Firecrawl fallback. Raw content lives in ignored `data/.cache/` and `scripts/data/.firecrawl/`. Direct HTTP successfully retrieves the FDA briefing as a 1.6 MB PDF; a web screenshot rendering attempt separately redirected to an FDA not-found page. That rendering failure does not erase the independently fetched file, but it illustrates transport differences.

Catalog validation checks unique IDs, source references, ISO dates/cutoff, future-event labeling, pending past-target cases, target provenance and excerpt limits. It does not verify the scientific truth of source statements. Eight mutation-based unit tests cover reference breakage, temporal leakage, target support and text-retention constraints.

`evaluation-cases.json` is a small authored reasoning suite grounded in these real sources. Rubrics must remain separate from model prompts. This suite is not prospective approval validation and does not support a calibrated probability claim.

## Later discovery in the recorded challenge

The catalog is the initial curated evidence packet, not a comprehensive index of every disclosure available by September 10. The real apitegromab challenge subsequently found and the reviewer verified [Scholar Rock's August 21 update](https://investors.scholarrock.com/news-releases/news-release-details/scholar-rock-provides-update-global-apitegromab-regulatory): Catalent removal is completed, while alternative-site review continues and September 30 remains the reported target. The original August 7 packet used prospective removal wording. The catalog remains fixed for reproducibility; the challenge's additional sources and revised assessment are preserved in its original recorded answer. This is a coverage omission corrected by further research, not a later-than-cutoff event.
