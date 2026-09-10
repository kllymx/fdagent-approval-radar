# FDAgent Approval Radar

**Investigate what could change an FDA drug-review outcome, using public evidence and GPT-6 Astra.**

Approval Radar follows nine real drug–indication review episodes. It connects sponsor disclosures, trial records, FDA statistical reviews and complete-response letters, then asks Astra to test the strongest case and its counterevidence. No customer documents or fictional records are needed.

Built for the GPT-6 Astra hackathon in New York. This is an original, standalone public project; the private FDAgent application and its data are not included.

![Approval Radar using FDAgent's visual conventions, displaying a genuine recorded Astra investigation](docs/assets/approval-radar.png)

## Try it

- [Public interactive demo](https://kllymx.github.io/fdagent-approval-radar/) — genuine recorded Astra investigations, clearly labeled; no API key required.
- [Four-minute demo script](docs/demo-script.md)
- [Evidence evaluation](docs/evidence-evaluation.md) and [independent agent review of the recorded runs](data/recorded-run-review.md)
- [Product thesis and customer experiment](docs/product-thesis.md)

The public demo is a September 10, 2026 evidence snapshot. Its dates and status are not automatically refreshed. Live local investigations can retrieve newer evidence and must distinguish that from the snapshot.

Company logos come from Firecrawl's branding extraction of official sponsor sites. The app serves the verified assets locally; [brand provenance and refresh instructions](public/brands/README.md) explain their sources and ownership.

## What Astra actually does

1. Starts with a sourced candidate packet and a specific regulatory question.
2. Chooses tools to read full FDA documents, search inside long reports, retrieve trial protocols/results, search FDA letters and discover current public disclosures.
3. Reconciles competing analyses, source authority, dates and evidence gaps.
4. Produces a cited outlook, timing uncertainty, counterevidence, relevant review histories when supported, and the next evidence that would change its judgment.
5. Accepts a challenge against a prior investigation, carries its sources forward and tests whether revision is warranted. Reports can be exported as Markdown.

The interface shows actual tool progress. Recorded reports preserve their model ID, question, tool trace, token use and measured duration. Source-ID validation checks that references exist; it does **not** establish that every claim is scientifically correct.

Two real examples are included:

- **Apitegromab:** Astra found the FDA CRL and separated remediation of the old facility from acceptance of a replacement. It discovered labeling and safety-update obligations beyond the catalog's manufacturing summary.
- **Deramiocel:** Astra reconciled FDA and sponsor endpoint analyses, preserved the distinction between post-completion and post-unblinding changes, and found a later cardiac-analysis correction. It assessed the later indication amendment without treating a prior FDA briefing as the final decision.

A third recorded **challenge** found an August 21 update confirming that Catalent's removal was completed. Astra corrected the earlier prospective wording and added a sourced linvoseltamab review comparison, while keeping product-specific FDA acceptance unresolved. This demonstrates a real evidence-driven revision.

In five additional original-document exercises, a separate project agent marked **19 of 20 predefined distinctions met and one partially met**. The questions, unchanged answers, exact grading pointers and retry disclosure are public. This small, selected and agent-graded exercise has no comparison model and is not an approval-accuracy benchmark.

## Forecasting, with measurable limits

A PDUFA target is an **FDA action target**, not a promised approval date. This project does not invent an individual probability or an exact future approval date.

The public-data model is reproducible and evaluated separately from Astra:

| Question | Evidence and result |
| --- | --- |
| Can review class forecast annual first-cycle approval rates? | Frozen historical class means: **6.9 percentage-point MAE** on **six held-out annual cohort rates**, versus **11.6 pp** for a pooled baseline. This is not individual drug accuracy. |
| Can historical counts predict action by the applicable goal? | **603 held-out due/resolved action outcomes**. Class Brier score **0.0390**, pooled **0.0383**: the pooled baseline performed slightly better. An on-time action can be a CRL. |
| What about unfinished reviews? | Eight held-out actions still within goal remain unresolved and are excluded from binary scoring. |
| What does a CRL do to a timeline? | Twelve selected, real FDA review histories show review cycles and sponsor-response intervals. All were eventually approved in the selected appendix; they cannot estimate approval probability. |

Read [model methodology, source vintages and reproduction commands](model/README.md). Individual probabilities remain `null`. A future drug-level model needs a complete application-cycle cohort, timestamped feature snapshots, reliable unsuccessful/pending outcomes and prospective calibration. An approvals-only database or the selectively disclosed CRL archive cannot provide that on its own.

## Run locally

Requirements: Node.js 22+, pnpm 11, Python 3.9+ for data/model checks, and `pdftotext` for live PDF reading (`brew install poppler` on macOS; `apt install poppler-utils` on Debian/Ubuntu).

```bash
pnpm install
cp .env.example .env.local
# Set ASTRA_API_KEY in .env.local. Add FIRECRAWL_API_KEY for live web discovery.
pnpm preflight
pnpm dev
```

Open `http://127.0.0.1:5178`. The API runs on port 8788. Without credentials, the catalog, evaluated model and recorded runs remain available. Live research requires Astra access; there is no silent model fallback.

`ASTRA_BASE_URL` can point to an event-provided OpenAI-compatible Responses endpoint. Keep keys server-side. The API uses `gpt-6-astra`, structured output, function calls and configurable reasoning effort. Firecrawl is optional; without it, public FDA/trial APIs and curated sources remain available, while web-search failures are reported.

```bash
pnpm test
pnpm data:validate
python3 -m unittest discover -s scripts/data -p 'test_*.py'
python3 model/rebuild.py --check
python3 -m unittest discover -s model -p 'test_*.py'
pnpm build
pnpm start
```

For a static public demo containing only explicitly recorded runs:

```bash
VITE_BASE_PATH=/fdagent-approval-radar/ pnpm build:demo
```

Serve `dist/` at that base path. Set `VITE_BASE_PATH=/` for root hosting. No credentials or paid backend are bundled.

## Data and evaluation

- [Catalog](data/catalog.json): nine review episodes, 31 primary source records, milestones, scoped signals and retrieval dates.
- [Source audit](data/source-audit.md) and [refresh tools](scripts/data/README.md): reproducible transport/hash checks, including failures. Fetch success does not certify scientific accuracy.
- [Model](model/): eight FDA annual reports, aggregate observations, source hashes, exact computation and tests.
- [Five authored reasoning challenges](data/evaluation-cases.json): original-document questions and a transparent rubric. These are a small case study, not a representative benchmark or forecast validation.

To fetch the evaluation documents and run the document-only harness:

```bash
python3 scripts/data/refresh_sources.py --firecrawl
pnpm evaluate
```

The optional `--firecrawl` flag requires an installed, authenticated Firecrawl CLI; omit it for direct public retrieval only. Blocked sources must be retrieved before evaluating. The harness withholds candidate summaries, curated signals and expected answers from Astra. Outputs and source hashes are saved under ignored `.runtime/evaluation/`; grading is a separate review. Existing completed outputs are reused; remove that local directory deliberately for a fresh full run. API calls incur provider charges.

## Architecture and deployment

React/Vite interface → Node HTTP API → Astra Responses tool loop → public FDA/ClinicalTrials.gov APIs and optional Firecrawl. Historical computation is dependency-free Python; the interface reads its checked-in artifact.

The default server binds to loopback. A public live server requires `RADAR_ACCESS_TOKEN`; authenticated clients send it as a bearer token. Public reads expose the curated catalog and deliberately recorded runs. Unpublished runtime runs require authorization when a token is configured. The browser demo intentionally has no public paid-research endpoint. Live requests are limited to two concurrent runs, a bounded tool budget and an eight-minute request deadline.

Raw source caches, local questions/runs and `.env` files are ignored. Publishing an investigation is an explicit step using `scripts/record.ts` after review; it strips source bodies and copied search snippets while preserving model findings. Retrieved documents are untrusted evidence and never authorize actions or access to secrets.

## License

Original code is [MIT licensed](LICENSE). FDA, registry and sponsor materials retain their own terms. Linked third-party publications and press releases are not relicensed or redistributed in full. Public source metadata, short attributed summaries and original model outputs are included for inspection.
