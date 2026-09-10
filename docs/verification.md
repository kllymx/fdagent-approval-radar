# Verification performed on September 10, 2026

## Application and data

- TypeScript check and production build passed locally.
- 22 TypeScript tests passed: report references/probability field, public URL/domain handling, CRL search format, exact source search, stream decoding, static paths and report export.
- Eight Python model tests and eight catalog integrity tests passed.
- The checked-in model artifact reproduced exactly with `python3 model/rebuild.py --check`.
- Catalog validation passed for nine candidates and 31 sources. The separate transport refresh retrieved all 31 through direct HTTPS or explicitly recorded Firecrawl fallback; this is not a scientific certification.
- Live public-API checks found six CRLs for numeric application 210852, verified that the specific source URL resolves the intended letter date, and found the statistical term `0.045` on PDF pages 40 and 52 of the full deramiocel FDA briefing, beyond the initial source-read limit.
- HTTP smoke checks covered dashboard access, missing records, malformed request fields and rejected cross-site research requests.

## Actual model execution

The configured provider returned `gpt-6-astra` on preflight. Two initial investigations and one challenge completed against the real API. Their unchanged findings and tool traces are in `data/investigations/`, with metadata sanitation explained in each recording. A separate project research agent checked consequential claims; see `data/recorded-run-review.md` for scope and limits.

Five original-document exercises completed separately. The expected answers were withheld from the model, and a manual project-agent rubric review is published in `data/evaluation-results.json`. One initial attempt did not complete and was retried with a larger output budget; complete details that were not retained are explicitly identified. The exercise is not a representative performance benchmark.

## Browser and publication

Browser checks exercised desktop and mobile candidate selection, evidence links, source drawer, saved investigations, challenge controls, Markdown download, model charts and historical review drilldowns. Static mode was checked without an API backend: it reads only public snapshots, labels recorded runs and disables paid live actions.

The public project was created independently of the private FDAgent repository. Publication checks exclude environment files, raw source caches, unpublished runtime outputs and credentials. Original model outputs are retained; long copied web-source descriptions are replaced with short metadata notices. The code uses FDAgent's visual conventions without copying its private implementation.

These checks do not establish clinical correctness for every sentence, comprehensive coverage, production service reliability, individual forecast calibration or investment performance. The reproducible tests and original evidence make the implemented behavior inspectable.
