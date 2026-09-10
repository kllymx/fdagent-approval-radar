# Company brand assets

These official company logos and icons were extracted from sponsor websites using Firecrawl's `/v2/scrape` endpoint with `formats: ["branding"]`. They identify the companies discussed in the public evidence. Trademarks remain the property of their owners; inclusion does not imply endorsement and these assets are not covered by the code's MIT license.

`data/brands.json` records source pages, original asset URLs, retrieval timestamps and SHA-256 hashes. `data/brand-sites.json` maps the ten companies to nine drug–indication records. Nuvalent and GSK both appear for their documented relationship.

Run `pnpm brands` with `FIRECRAWL_API_KEY` or an authenticated Firecrawl CLI to reproduce. Existing branding responses are cached outside version control; `pnpm brands --refresh` requests profiles again. The published UI loads local assets and does not expose credentials or make branding API calls from the browser.

Scholar Rock's SVG is returned inline by Firecrawl. Praxis, Scholar Rock and Nuvalent have white wordmarks, so the interface places them on a dark surface. GSK's static official mark is used instead of its animated homepage logo. Ultragenyx's main-site assets denied direct retrieval; its investor-site branding supplies the official icon used here. PolyPid's legacy Adobe XML namespace declarations are expanded and its document type removed; paths and colors remain unchanged. No logos were invented, recolored or reconstructed.
