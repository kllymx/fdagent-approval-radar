import type { Source } from "../shared/schema.js";
import { setTimeout as delay } from "node:timers/promises";

export type EvidenceFamily = "trials" | "approvals" | "labels" | "publications";
export interface EvidenceQuery {
  nctIds?: string[];
  drug?: string;
  sponsor?: string;
  indication?: string;
  applicationNumber?: string;
  limit?: number;
}
export interface EvidenceOptions {
  signal?: AbortSignal;
  fetch?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
  limit?: number;
}
export interface EvidenceRecord {
  id: string;
  sourceId: string;
  title: string;
  url: string;
  summary: string;
  fields: Record<string, unknown>;
}
export interface EvidenceResult {
  family: EvidenceFamily;
  query: EvidenceQuery;
  queryUrl: string;
  retrievedAt: string;
  total: number | null;
  records: EvidenceRecord[];
  sources: Source[];
  coverage: string;
  limitations: string[];
}

export const evidenceFamilies = [
  {
    id: "trials",
    title: "ClinicalTrials.gov",
    scope:
      "Registered protocols and posted results availability; not FDA review conclusions.",
  },
  {
    id: "approvals",
    title: "Drugs@FDA",
    scope:
      "Application and submission records for approved products; not a complete pending-application registry.",
  },
  {
    id: "labels",
    title: "openFDA drug labels",
    scope:
      "Company-submitted Structured Product Labeling; listing does not itself establish FDA approval.",
  },
  {
    id: "publications",
    title: "PubMed",
    scope:
      "Indexed publication metadata; titles and indexing do not establish efficacy or regulatory sufficiency.",
  },
] as const;

const MAX_RESULTS = 8;
const MAX_BYTES = 4 * 1024 * 1024;
type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Obj)
    : {};
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const txt = (value: unknown, limit = 400): string =>
  typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, limit)
    : "";
const strings = (value: unknown, limit = 12) =>
  arr(value)
    .map((x) => txt(x))
    .filter(Boolean)
    .slice(0, limit);
const count = (value: unknown): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
const phrase = (value: string) =>
  `"${value.replace(/["\\]/g, " ").replace(/\s+/g, " ").trim()}"`;
const apiUrl = (base: string, params: Record<string, string>) => {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, value);
  return url.toString();
};

// Date precision is never invented: month/year-only dates remain in raw fields.
function isoDate(value: unknown): string | null {
  const raw = txt(value);
  const normalized = /^\d{8}$/.test(raw)
    ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
    : raw;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const d = new Date(`${normalized}T00:00:00Z`);
  return Number.isFinite(d.getTime()) &&
    d.toISOString().slice(0, 10) === normalized
    ? normalized
    : null;
}

function normalizeQuery(
  input: EvidenceQuery | string,
  options: EvidenceOptions,
): EvidenceQuery & { limit: number } {
  const value = typeof input === "string" ? { drug: input } : input;
  if (!value || typeof value !== "object")
    throw Error("A public evidence query is required.");
  const query: EvidenceQuery = {};
  if (value.nctIds !== undefined) {
    if (
      !Array.isArray(value.nctIds) ||
      value.nctIds.length > 8 ||
      value.nctIds.some((id) => !/^NCT\d{8}$/.test(id))
    )
      throw Error("Provide at most eight exact NCT identifiers.");
    if (value.nctIds.length) query.nctIds = [...new Set(value.nctIds)];
  }
  for (const key of [
    "drug",
    "sponsor",
    "indication",
    "applicationNumber",
  ] as const) {
    if (value[key] === undefined || value[key] === "") continue;
    if (typeof value[key] !== "string" || value[key]!.length > 240)
      throw Error(`${key} must be a string of at most 240 characters.`);
    const normalized = txt(value[key])
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .trim();
    if (normalized) query[key] = normalized;
  }
  if (!Object.keys(query).length)
    throw Error("Provide a drug, sponsor, indication, or application number.");
  const limit = options.limit ?? value.limit ?? 5;
  if (!Number.isInteger(limit) || limit < 1)
    throw Error("Evidence result limit must be a positive integer.");
  return { ...query, limit: Math.min(limit, MAX_RESULTS) };
}

function applicationTerm(value: string): string {
  const match = /^(NDA|BLA|ANDA)?\s*0*(\d{1,6})$/i.exec(value);
  if (!match)
    throw Error(
      "Use an NDA, BLA, or ANDA application number, such as NDA210852.",
    );
  const number = match[2].padStart(6, "0");
  return match[1]
    ? `"${match[1].toUpperCase()}${number}"`
    : `("NDA${number}" OR "BLA${number}" OR "ANDA${number}")`;
}

// Requests have fixed official destinations; no caller-controlled URL or redirects.
async function requestJson(
  url: string,
  options: EvidenceOptions,
  openFdaEmpty = false,
): Promise<Obj> {
  options.signal?.throwIfAborted();
  const timeout = options.timeoutMs ?? 15_000;
  if (!Number.isFinite(timeout) || timeout < 1 || timeout > 30_000)
    throw Error("Evidence timeout must be between 1 and 30000 milliseconds.");
  const controller = new AbortController();
  const signal = options.signal
    ? AbortSignal.any([options.signal, controller.signal])
    : controller.signal;
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await (options.fetch ?? fetch)(url, {
      signal,
      redirect: "error",
      headers: { Accept: "application/json" },
    });
    if (Number(response.headers.get("content-length")) > MAX_BYTES) {
      await response.body?.cancel().catch(() => undefined);
      throw Error("Evidence response exceeds the 4 MiB limit.");
    }
    const reader = response.body?.getReader();
    if (!reader)
      throw Error("Evidence endpoint returned an empty response body.");
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > MAX_BYTES)
          throw Error("Evidence response exceeds the 4 MiB limit.");
        chunks.push(value);
      }
    } catch (error) {
      await reader.cancel().catch(() => undefined);
      throw error;
    }
    const bytes = new Uint8Array(length);
    signal.throwIfAborted();
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    let data: Obj;
    try {
      data = obj(JSON.parse(new TextDecoder().decode(bytes)));
    } catch {
      throw Error(
        `Evidence endpoint returned invalid JSON (HTTP ${response.status}).`,
      );
    }
    if (
      openFdaEmpty &&
      response.status === 404 &&
      obj(data.error).code === "NOT_FOUND"
    )
      return { results: [], meta: { results: { total: 0 } } };
    if (!response.ok)
      throw Error(
        `Evidence endpoint returned HTTP ${response.status}; no absence finding can be inferred.`,
      );
    if (data.error || data.ERROR)
      throw Error(
        "Evidence endpoint reported an error; no absence finding can be inferred.",
      );
    return data;
  } catch (error) {
    options.signal?.throwIfAborted();
    if (controller.signal.aborted)
      throw Error(`Evidence request timed out after ${timeout} ms.`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function resultBase(
  family: EvidenceFamily,
  query: EvidenceQuery,
  queryUrl: string,
  options: EvidenceOptions,
): EvidenceResult {
  return {
    family,
    query,
    queryUrl,
    retrievedAt: (options.now?.() ?? new Date()).toISOString(),
    total: null,
    records: [],
    sources: [],
    coverage: evidenceFamilies.find((x) => x.id === family)!.scope,
    limitations: [
      "Current public snapshot; not a historical as-of dataset. Retrieval time is not the event or publication date.",
      "Search matches require drug, sponsor, formulation, and indication verification; a name match alone is not a confirmed candidate match.",
      "Results are bounded and may omit aliases, older records, unindexed evidence, and undisclosed information. No match means unknown, not a negative finding.",
    ],
  };
}

function append(
  result: EvidenceResult,
  record: Omit<EvidenceRecord, "sourceId">,
  kind: Source["kind"],
  publisher: string,
  publishedAt: string | null,
) {
  const sourceId = `evidence-${result.family}-${record.id}`;
  if (result.sources.some((source) => source.id === sourceId)) return;
  const normalized = { ...record, sourceId };
  result.records.push(normalized);
  result.sources.push({
    contentKind: "metadata",
    id: sourceId,
    title: record.title,
    url: record.url,
    kind,
    publisher,
    publishedAt,
    retrievedAt: result.retrievedAt,
    summary: record.summary,
    fullText: JSON.stringify(
      {
        ...normalized,
        coverage: result.coverage,
        limitations: result.limitations,
        queryUrl: result.queryUrl,
        retrievedAt: result.retrievedAt,
      },
      null,
      2,
    ),
  });
}

async function trials(
  query: EvidenceQuery & { limit: number },
  options: EvidenceOptions,
): Promise<EvidenceResult> {
  if (
    !query.drug &&
    !query.sponsor &&
    !query.indication &&
    !query.nctIds?.length
  )
    throw Error("Trial search requires a drug, sponsor, or indication.");
  const params: Record<string, string> = {
    format: "json",
    countTotal: "true",
    pageSize: String(query.limit),
    fields:
      "NCTId,BriefTitle,OverallStatus,Phase,LeadSponsorName,InterventionName,Condition,EnrollmentCount,EnrollmentType,StudyType,PrimaryOutcomeMeasure,PrimaryOutcomeTimeFrame,PrimaryCompletionDate,PrimaryCompletionDateType,LastUpdatePostDate,ResultsFirstPostDate,HasResults",
  };
  if (query.nctIds?.length) params["filter.ids"] = query.nctIds.join(",");
  else {
    if (query.drug) params["query.intr"] = phrase(query.drug);
    if (query.sponsor) params["query.spons"] = phrase(query.sponsor);
    if (query.indication) params["query.cond"] = phrase(query.indication);
  }
  const url = apiUrl("https://clinicaltrials.gov/api/v2/studies", params);
  const data = await requestJson(url, options);
  if (!Array.isArray(data.studies))
    throw Error("ClinicalTrials.gov returned an unexpected response schema.");
  const result = resultBase("trials", query, url, options);
  if (query.nctIds?.length)
    result.coverage +=
      " Exact catalog-linked NCT identifiers were retrieved; this is not an exhaustive drug-name search.";
  result.total = count(data.totalCount);
  result.limitations.push(
    "Sponsor/condition filters are combined with the intervention filter. Study completion and posted-results availability do not establish endpoint success, FDA acceptance, or approval.",
  );
  if (query.applicationNumber)
    result.limitations.push(
      "Application number is not searched in this registry; only the supplied intervention, sponsor, and condition filters are used.",
    );
  for (const raw of data.studies.slice(0, query.limit)) {
    const study = obj(raw),
      protocol = obj(study.protocolSection);
    const identification = obj(protocol.identificationModule),
      status = obj(protocol.statusModule),
      design = obj(protocol.designModule);
    const id = txt(identification.nctId);
    if (!/^NCT\d{8}$/.test(id)) continue;
    const title = txt(identification.briefTitle, 700) || id;
    const updated = txt(obj(status.lastUpdatePostDateStruct).date);
    const sponsor = txt(
      obj(obj(protocol.sponsorCollaboratorsModule).leadSponsor).name,
    );
    const primary = arr(obj(protocol.outcomesModule).primaryOutcomes);
    const fields = {
      nctId: id,
      sponsor: sponsor || null,
      status: txt(status.overallStatus) || null,
      phases: strings(design.phases),
      studyType: txt(design.studyType) || null,
      conditions: strings(obj(protocol.conditionsModule).conditions),
      interventions: arr(obj(protocol.armsInterventionsModule).interventions)
        .slice(0, 12)
        .map((x) => txt(obj(x).name))
        .filter(Boolean),
      enrollment: {
        count: count(obj(design.enrollmentInfo).count),
        type: txt(obj(design.enrollmentInfo).type) || null,
      },
      primaryOutcomes: primary.slice(0, 6).map((x) => ({
        measure: txt(obj(x).measure, 500),
        timeFrame: txt(obj(x).timeFrame, 250),
      })),
      primaryOutcomesReturned: Math.min(primary.length, 6),
      primaryOutcomesTotal: primary.length,
      primaryCompletionDate:
        txt(obj(status.primaryCompletionDateStruct).date) || null,
      primaryCompletionDateType:
        txt(obj(status.primaryCompletionDateStruct).type) || null,
      lastUpdatePostDate: updated || null,
      resultsFirstPostDate:
        txt(obj(status.resultsFirstPostDateStruct).date) || null,
      hasPostedResults:
        typeof study.hasResults === "boolean" ? study.hasResults : null,
    };
    append(
      result,
      {
        id,
        title,
        url: `https://clinicaltrials.gov/study/${id}`,
        fields,
        summary: `Registry protocol: ${fields.status ?? "status unavailable"}; ${fields.phases.join(", ") || "phase unavailable"}; lead sponsor ${sponsor || "unavailable"}. Results availability is not an efficacy conclusion.`,
      },
      "trial",
      "ClinicalTrials.gov / National Library of Medicine",
      isoDate(updated),
    );
  }
  return result;
}

function fdaDocumentUrl(value: unknown): string | null {
  try {
    const url = new URL(txt(value, 2_000));
    if (url.hostname !== "fda.gov" && !url.hostname.endsWith(".fda.gov"))
      return null;
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port
    )
      return null;
    url.protocol = "https:";
    return url.toString();
  } catch {
    return null;
  }
}

async function approvals(
  query: EvidenceQuery & { limit: number },
  options: EvidenceOptions,
): Promise<EvidenceResult> {
  const terms: string[] = [];
  // An exact application lookup deliberately overrides name/sponsor text: naming
  // changes must not conceal the requested record. Indication is not an API field.
  if (query.applicationNumber)
    terms.push(
      `application_number:${applicationTerm(query.applicationNumber)}`,
    );
  else {
    if (query.drug)
      terms.push(
        `(products.brand_name:${phrase(query.drug)} OR products.active_ingredients.name:${phrase(query.drug)} OR openfda.generic_name:${phrase(query.drug)})`,
      );
    if (query.sponsor) terms.push(`sponsor_name:${phrase(query.sponsor)}`);
  }
  if (!terms.length)
    throw Error(
      "Approval search requires a drug, sponsor, or application number; indication alone is not searchable in Drugs@FDA.",
    );
  const url = apiUrl("https://api.fda.gov/drug/drugsfda.json", {
    search: terms.join(" AND "),
    limit: String(query.limit),
  });
  const data = await requestJson(url, options, true);
  if (!Array.isArray(data.results))
    throw Error("Drugs@FDA returned an unexpected response schema.");
  const result = resultBase("approvals", query, url, options);
  result.total = count(obj(obj(data.meta).results).total);
  result.limitations.push(
    "Approved-product records can supply comparator histories. They are not a denominator for pending applications or rejected products, and do not establish the requested indication is approved.",
    "Submission status dates are FDA action/status dates, not submission receipt dates. ORIG and SUPPL records remain separate; latest supplements may concern other indications.",
  );
  if (query.applicationNumber)
    result.limitations.push(
      "Exact application-number lookup takes precedence over drug and sponsor text filters.",
    );
  if (query.indication)
    result.limitations.push(
      "The supplied indication is not used to filter Drugs@FDA; verify indication against the relevant approved labeling/review.",
    );
  for (const raw of data.results.slice(0, query.limit)) {
    const record = obj(raw),
      id = txt(record.application_number);
    if (!/^(NDA|ANDA|BLA)\d{6}$/.test(id)) continue;
    const allSubmissions = arr(record.submissions).map(obj);
    const ordered = [...allSubmissions].sort((a, b) => {
      const orig =
        Number(b.submission_type === "ORIG") -
        Number(a.submission_type === "ORIG");
      return (
        orig ||
        txt(b.submission_status_date).localeCompare(
          txt(a.submission_status_date),
        )
      );
    });
    const products = arr(record.products)
      .slice(0, 8)
      .map((x) => {
        const p = obj(x);
        return {
          brandName: txt(p.brand_name),
          dosageForm: txt(p.dosage_form),
          route: txt(p.route),
          marketingStatus: txt(p.marketing_status),
          ingredients: arr(p.active_ingredients)
            .slice(0, 8)
            .map((i) => ({
              name: txt(obj(i).name),
              strength: txt(obj(i).strength) || null,
            })),
        };
      });
    const submissions = ordered.slice(0, 12).map((s) => ({
      type: txt(s.submission_type),
      number: txt(s.submission_number),
      status: txt(s.submission_status),
      statusDate: isoDate(s.submission_status_date),
      reviewPriority: txt(s.review_priority) || null,
      classDescription: txt(s.submission_class_code_description) || null,
      documents: arr(s.application_docs)
        .slice(0, 6)
        .map((d) => ({
          type: txt(obj(d).type),
          documentDate: isoDate(obj(d).date),
          url: fdaDocumentUrl(obj(d).url),
        }))
        .filter((d) => d.url),
    }));
    const title = `${
      products
        .map((p) => p.brandName)
        .filter((v, i, a) => v && a.indexOf(v) === i)
        .join(" / ") || "Drug application"
    } — ${id}`;
    const detailUrl = apiUrl("https://api.fda.gov/drug/drugsfda.json", {
      search: `application_number:${phrase(id)}`,
      limit: "1",
    });
    append(
      result,
      {
        id,
        title,
        url: detailUrl,
        summary: `${id}; sponsor ${txt(record.sponsor_name) || "unavailable"}. ${submissions.length} of ${allSubmissions.length} submission records shown, with original applications prioritized. Indication match is unverified.`,
        fields: {
          applicationNumber: id,
          sponsor: txt(record.sponsor_name) || null,
          products,
          productsTotal: arr(record.products).length,
          submissions,
          submissionsTotal: allSubmissions.length,
          applicationPage: `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${id.replace(/\D/g, "")}`,
          candidateIndicationMatch: "unverified",
        },
      },
      "fda",
      "FDA / Drugs@FDA via openFDA",
      null,
    );
  }
  return result;
}

async function labels(
  query: EvidenceQuery & { limit: number },
  options: EvidenceOptions,
): Promise<EvidenceResult> {
  const terms: string[] = [];
  if (query.applicationNumber)
    terms.push(
      `openfda.application_number:${applicationTerm(query.applicationNumber)}`,
    );
  else {
    if (query.drug)
      terms.push(
        `(openfda.brand_name:${phrase(query.drug)} OR openfda.generic_name:${phrase(query.drug)} OR openfda.substance_name:${phrase(query.drug)})`,
      );
    if (query.sponsor)
      terms.push(`openfda.manufacturer_name:${phrase(query.sponsor)}`);
  }
  if (query.indication)
    terms.push(`indications_and_usage:${phrase(query.indication)}`);
  const url = apiUrl("https://api.fda.gov/drug/label.json", {
    search: terms.join(" AND "),
    limit: String(query.limit),
    sort: "effective_time:desc",
  });
  const data = await requestJson(url, options, true);
  if (!Array.isArray(data.results))
    throw Error("openFDA labels returned an unexpected response schema.");
  const result = resultBase("labels", query, url, options);
  result.total = count(obj(obj(data.meta).results).total);
  result.limitations.push(
    "SPL is company-submitted listing information; openFDA says its content is not verified and may differ from approved or currently distributed labeling. A label hit is not proof of FDA approval.",
    "Label effective date is not publication date, first approval date, or proof of availability at a historical cutoff. Section presence is not a clinical risk assessment.",
    "Only a short indication excerpt and section availability are returned; open the full source to assess populations, warnings, and clinical data.",
  );
  if (query.sponsor && !query.applicationNumber)
    result.limitations.push(
      "Sponsor text is searched as manufacturer name; these entities can differ.",
    );
  if (query.applicationNumber)
    result.limitations.push(
      "Exact application number replaces drug/manufacturer text; any indication filter is still applied.",
    );
  const sections = [
    "indications_and_usage",
    "boxed_warning",
    "contraindications",
    "warnings_and_cautions",
    "adverse_reactions",
    "clinical_studies",
    "dosage_and_administration",
  ];
  for (const raw of data.results.slice(0, query.limit)) {
    const label = obj(raw),
      harmonized = obj(label.openfda);
    const id = txt(label.id),
      setId = txt(label.set_id);
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) continue;
    const brand = strings(harmonized.brand_name),
      generic = strings(harmonized.generic_name);
    const sectionAvailability = Object.fromEntries(
      sections.map((key) => [
        key,
        arr(label[key]).some((x) => Boolean(txt(x))),
      ]),
    );
    const indicationText = arr(label.indications_and_usage)
      .map((x) => txt(x, 1_200))
      .join(" ");
    const excerpt = indicationText
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 25)
      .join(" ");
    const title = `${brand.join(" / ") || generic.join(" / ") || "Drug"} — submitted label`;
    append(
      result,
      {
        id,
        title,
        url: apiUrl("https://api.fda.gov/drug/label.json", {
          search: `id:${phrase(id)}`,
          limit: "1",
        }),
        summary: `Company-submitted label; effective date ${isoDate(label.effective_time) ?? "unavailable"}. Approval and candidate-indication matching require separate verification.`,
        fields: {
          labelId: id,
          setId: setId || null,
          brandNames: brand,
          genericNames: generic,
          manufacturers: strings(harmonized.manufacturer_name),
          applicationNumbers: strings(harmonized.application_number),
          productTypes: strings(harmonized.product_type),
          labelEffectiveDate: isoDate(label.effective_time),
          sectionAvailability,
          indicationExcerpt: excerpt || null,
          indicationExcerptTruncated:
            indicationText.split(/\s+/).filter(Boolean).length > 25,
          approvalVerification: "not_determined_by_this_source",
          dailyMedUrl: /^[a-fA-F0-9-]{36}$/.test(setId)
            ? `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${setId}`
            : null,
        },
      },
      "fda",
      "Company-submitted SPL via FDA openFDA",
      null,
    );
  }
  return result;
}

// Reserve request start slots, including concurrent callers, below NCBI's
// unauthenticated three-requests/second limit. No credentials are needed.
let nextPubmedRequestAt = 0;
let pubmedStartQueue: Promise<void> = Promise.resolve();
async function pubmedJson(url: string, options: EvidenceOptions): Promise<Obj> {
  options.signal?.throwIfAborted();
  const enqueuedAt = Date.now();
  const start = pubmedStartQueue.then(async () => {
    options.signal?.throwIfAborted();
    const wait = Math.max(0, nextPubmedRequestAt - Date.now());
    if (Date.now() - enqueuedAt + wait > 5_000)
      throw Error("PubMed request queue is busy; retry shortly.");
    if (wait) await delay(wait, undefined, { signal: options.signal });
    options.signal?.throwIfAborted();
    // Use actual start time: a stalled event loop must not release a burst of
    // previously reserved requests when it resumes.
    nextPubmedRequestAt = Date.now() + 350;
  });
  pubmedStartQueue = start.catch(() => undefined);
  await start;
  return requestJson(url, options);
}

async function publications(
  query: EvidenceQuery & { limit: number },
  options: EvidenceOptions,
): Promise<EvidenceResult> {
  if (!query.drug && !query.indication)
    throw Error(
      "PubMed search requires a drug or indication; sponsor affiliation alone is not a reliable trial-sponsor search.",
    );
  const terms = [query.drug, query.indication]
    .filter((v): v is string => Boolean(v))
    .map((term) => `${phrase(term)}[Title/Abstract]`);
  terms.push(
    '(clinical trial[Publication Type] OR randomized controlled trial[Publication Type] OR "phase 2"[Title/Abstract] OR "phase 3"[Title/Abstract] OR "phase II"[Title/Abstract] OR "phase III"[Title/Abstract])',
  );
  const url = apiUrl(
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi",
    {
      db: "pubmed",
      term: terms.join(" AND "),
      retmode: "json",
      retmax: String(query.limit),
      sort: "relevance",
      tool: "fdagent_approval_radar",
    },
  );
  const data = await pubmedJson(url, options),
    search = obj(data.esearchresult);
  if (!Array.isArray(search.idlist))
    throw Error("PubMed returned an unexpected search response schema.");
  if (search.ERROR || arr(obj(search.errorlist).phrasesnotfound).length)
    throw Error(
      "PubMed could not interpret a search phrase; refine the query.",
    );
  const result = resultBase("publications", query, url, options);
  result.total = /^\d+$/.test(txt(search.count))
    ? count(Number(search.count))
    : count(search.count);
  result.limitations.push(
    "Clinical publication discovery uses title/abstract drug and condition terms plus trial/phase indexing; this is not a systematic literature review and may miss unindexed or differently named studies.",
    "Only citation metadata is retrieved. Abstracts, full text, endpoint estimates, statistical methods, retractions, and risk of bias have not been appraised.",
    "Publication date and indexing are distinct from public availability at a forecast cutoff; no historical availability guarantee is made.",
  );
  if (query.sponsor || query.applicationNumber)
    result.limitations.push(
      "Sponsor and application number are not used as PubMed filters; article affiliations do not reliably identify trial sponsorship.",
    );
  const warnings = obj(search.warninglist);
  if (Object.keys(warnings).length)
    result.limitations.push(
      `PubMed search warnings: ${JSON.stringify(warnings).slice(0, 600)}`,
    );
  const ids = strings(search.idlist, query.limit).filter((id) =>
    /^\d+$/.test(id),
  );
  if (!ids.length) return result;
  const summaryUrl = apiUrl(
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi",
    {
      db: "pubmed",
      id: ids.join(","),
      retmode: "json",
      tool: "fdagent_approval_radar",
    },
  );
  const summaries = obj((await pubmedJson(summaryUrl, options)).result);
  if (!Array.isArray(summaries.uids))
    throw Error("PubMed returned an unexpected citation response schema.");
  result.retrievedAt = (options.now?.() ?? new Date()).toISOString();
  for (const id of ids) {
    const citation = obj(summaries[id]);
    if (!citation.uid || citation.error) continue;
    const title = txt(citation.title, 700) || `PubMed ${id}`;
    const journal = txt(citation.fulljournalname) || txt(citation.source);
    const doi = arr(citation.articleids)
      .map(obj)
      .find((x) => x.idtype === "doi");
    append(
      result,
      {
        id,
        title,
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        summary: `Indexed citation in ${journal || "journal unavailable"}; publication date ${txt(citation.pubdate) || "unavailable"}. Abstract and full text have not been assessed.`,
        fields: {
          pmid: id,
          journal: journal || null,
          publicationDate: txt(citation.pubdate) || null,
          electronicPublicationDate: txt(citation.epubdate) || null,
          publicationTypes: strings(citation.pubtype),
          authors: arr(citation.authors)
            .slice(0, 6)
            .map((x) => txt(obj(x).name))
            .filter(Boolean),
          doi: doi ? txt(doi.value) : null,
          citationStatus: txt(citation.pubstatus) || null,
          abstractRetrieved: false,
          fullTextRetrieved: false,
          summaryApiUrl: summaryUrl,
        },
      },
      "publication",
      "PubMed / National Library of Medicine",
      isoDate(citation.pubdate),
    );
  }
  return result;
}

/** Original public-API adapters. No FDAgent private implementation is imported. */
export async function executeEvidenceQuery(
  family: EvidenceFamily,
  input: EvidenceQuery | string,
  options: EvidenceOptions = {},
): Promise<EvidenceResult> {
  options.signal?.throwIfAborted();
  const query = normalizeQuery(input, options);
  switch (family) {
    case "trials":
      return trials(query, options);
    case "approvals":
      return approvals(query, options);
    case "labels":
      return labels(query, options);
    case "publications":
      return publications(query, options);
    default:
      throw Error("Unsupported public evidence family.");
  }
}
