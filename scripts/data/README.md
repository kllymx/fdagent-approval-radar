# Public evidence collection

The checked-in `data/catalog.json` contains real drug/indication review episodes. The collection is hand-curated from public sources and is not a training cohort, a live FDA registry, or an Astra-generated prediction. Source IDs are stable keys used throughout the UI and investigation output.

## Commands

```sh
python3 scripts/data/build_catalog.py
python3 scripts/data/validate_catalog.py
python3 -m unittest discover -s scripts/data -p 'test_*.py'
python3 scripts/data/refresh_sources.py
python3 scripts/data/refresh_sources.py --candidate deramiocel-dmd
```

`build_catalog.py` deterministically reproduces the curated snapshot. Its fixed timestamp identifies the original review, not a fresh retrieval. Updating the evidence cutoff or statements requires source review and edits to that file.

`refresh_sources.py` uses public HTTPS endpoints and the Python standard library. ClinicalTrials.gov pages are fetched through the public v2 JSON API. It writes transport status, hashes, retrieval dates, registry metadata and excerpt-presence checks to `data/source-health.json`; it does not overwrite the reviewed catalog or classify application outcomes. Failures are reported per source. Raw fetched pages/PDFs are stored in ignored `data/.cache/`. A successful request, changed hash or matching excerpt does not establish scientific truth, new information or pending FDA status.

Full sponsor/SEC-exhibit/trial prose is not redistributed. Checked-in source objects contain attributed paraphrases and at most 25 excerpt words. Sources on SEC.gov can still be authored by a sponsor. Government-authored FDA material may be retained with provenance; the full local deramiocel FDA briefing is cached for live review.

## Review procedure

1. Verify the drug, indication, sponsor, application/review episode and trial identifiers independently. A molecule's approval in one setting does not approve every setting.
2. Read the source's own publication date. Search-engine “published” metadata can be wrong. Preserve the occurrence date of a milestone separately from the later announcement date.
3. Search FDA and sponsor records for later action, including early approval, CRL, extension and acquisition. Old action calendars can remain stale after an early approval.
4. Compare current registry data against the source statement; a total enrollment number is not necessarily the pivotal analysis population. The registry is responsible-party submitted.
5. Add competing interpretations and open evidence gaps. Missing evidence is unknown; a sponsor's claim of “no concerns” is scoped to the described interaction.
6. Rebuild and validate. Review `data/source-audit.md`. Do not move current source content into historical prediction features without demonstrated public availability at the forecast date.

`data/evaluation-cases.json` contains evaluator-authored prompts and explicit rubrics over real documents. Keep rubrics out of model input and report the suite as a small curated reasoning evaluation, not clinical ground truth or prospective forecasting performance.

If a sponsor site blocks ordinary HTTPS, the optional `--firecrawl` flag uses an already installed and authenticated Firecrawl CLI. No credential is stored in this repository:

```sh
python3 scripts/data/refresh_sources.py --firecrawl --retry-failed
```

This preserves prior successful transport checks and retries prior failures, recording the extraction method and direct error. It consumes the configured service's scrape credits. Without that flag, the pipeline requires no service key.
