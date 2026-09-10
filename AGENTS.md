# Approval Radar hackathon collaboration

This is a new standalone public project for FDAgent. Build original code here; do not copy the private FDAgent repository, secrets, customer data, or git history. The user explicitly authorized parallel agents and publication of this hackathon project in a public repository. Root handles git, credentials, dependency installation, integration and publication.

Read docs/contracts.md. Root owns shared contracts and package/config/server files. Data lane owns data/** and scripts/data/**. Forecast lane owns model/** and research/model/**. Interface lane owns ui/**. Agents may read all nonsecret artifacts and must coordinate contract changes with root. Do not edit another lane's files, commit, publish, or print credentials. No fictional data or fabricated metrics in the product. Proposed features must be distinguished from implemented results.

All factual claims need a public source. A published FDA action target is not an approval promise. Forecasts must state outcome, horizon, cohort and evidence cutoff. Current application status and later-published documents must not become historical predictive features. Do not train or evaluate against data whose labeling cannot be justified. Public disclosures are incomplete; absence is unknown, not a negative finding. Quote checks establish source presence, not scientific truth. Clinical and manufacturing evidence must be specific to the candidate and indication.

Keep the app instrument-like: restrained blue accent, dense readable layout, 2px controls / 4px containers, flat surfaces. Real interactions over ornamental dashboards. No random/fake live activity or fake model calls. Recorded Astra runs must be labeled recorded, with model/source/timestamp provenance.

Verify meaningful changed behavior with tests. Run typecheck, test suite, production build and browser smoke before handoff. API access is server-side only. The model must fail explicitly rather than fall back to another model while displaying Astra.
