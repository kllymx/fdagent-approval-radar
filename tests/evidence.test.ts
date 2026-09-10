import assert from "node:assert/strict";
import test from "node:test";
import {
  executeEvidenceQuery,
  type EvidenceOptions,
} from "../server/evidence.js";
import { sourceSchema } from "../shared/schema.js";

const retrievedAt = "2026-09-10T16:00:00.000Z";
function fixture(responses: Array<unknown | Response>) {
  const requests: Array<{ url: URL; init?: RequestInit }> = [];
  const options: EvidenceOptions = {
    now: () => new Date(retrievedAt),
    fetch: async (input, init) => {
      requests.push({ url: new URL(String(input)), init });
      assert.ok(responses.length, "Unexpected extra request");
      const value = responses.shift();
      return value instanceof Response ? value : Response.json(value);
    },
  };
  return { options, requests };
}
const trial = {
  protocolSection: {
    identificationModule: { nctId: "NCT12345678", briefTitle: "Drug trial" },
    statusModule: {
      overallStatus: "COMPLETED",
      primaryCompletionDateStruct: { date: "2025-01", type: "ESTIMATED" },
      lastUpdatePostDateStruct: { date: "2025-02-03" },
    },
    sponsorCollaboratorsModule: { leadSponsor: { name: "Example Sponsor" } },
    designModule: {
      phases: ["PHASE3"],
      enrollmentInfo: { count: 82, type: "ACTUAL" },
    },
    outcomesModule: {
      primaryOutcomes: [{ measure: "Primary endpoint", timeFrame: "Week 16" }],
    },
  },
  hasResults: false,
};
test("exact catalog NCT identifiers bypass drug-name aliases and preserve explicit retrieval scope", async () => {
  const { options, requests } = fixture([{ studies: [trial], totalCount: 1 }]);
  const result = await executeEvidenceQuery(
    "trials",
    { drug: "A formulation alias", nctIds: ["NCT12345678"] },
    options,
  );
  assert.equal(requests[0].url.searchParams.get("filter.ids"), "NCT12345678");
  assert.equal(requests[0].url.searchParams.has("query.intr"), false);
  assert.equal(result.records[0].fields.nctId, "NCT12345678");
  assert.match(result.coverage, /not an exhaustive drug-name search/);
  await assert.rejects(
    () => executeEvidenceQuery("trials", { nctIds: ["bad-id"] }, options),
    /exact NCT/,
  );
});
const approval = {
  application_number: "NDA210852",
  sponsor_name: "Example Sponsor",
  products: [
    {
      brand_name: "EXAMPLE",
      active_ingredients: [{ name: "exampledrug", strength: "5MG" }],
    },
  ],
  submissions: [
    {
      submission_type: "SUPPL",
      submission_number: "2",
      submission_status: "AP",
      submission_status_date: "20260102",
    },
    {
      submission_type: "ORIG",
      submission_number: "1",
      submission_status: "AP",
      submission_status_date: "20200102",
      application_docs: [
        {
          type: "Label",
          date: "20200108",
          url: "http://www.accessdata.fda.gov/drugsatfda_docs/label/example.pdf",
        },
        { type: "Bad", url: "https://fda.gov.attacker.example/not-fda" },
        { type: "Bad", url: "https://evilfda.gov/not-fda" },
      ],
    },
  ],
};

test("trial search uses separate intervention/sponsor filters and reports registry scope", async () => {
  const { options, requests } = fixture([{ studies: [trial], totalCount: 12 }]);
  const result = await executeEvidenceQuery(
    "trials",
    {
      drug: 'drug " OR *',
      sponsor: "Example Sponsor",
      indication: "disease",
      limit: 100,
    },
    options,
  );
  const url = requests[0].url;
  assert.equal(url.origin, "https://clinicaltrials.gov");
  assert.equal(url.searchParams.get("query.intr"), '"drug OR *"');
  assert.equal(url.searchParams.get("query.spons"), '"Example Sponsor"');
  assert.equal(url.searchParams.get("query.cond"), '"disease"');
  assert.equal(url.searchParams.get("pageSize"), "8");
  assert.equal(url.searchParams.get("countTotal"), "true");
  assert.equal(requests[0].init?.redirect, "error");
  assert.ok(requests[0].init?.signal);
  assert.equal(result.records[0].fields.primaryCompletionDate, "2025-01");
  assert.equal(result.records[0].fields.primaryCompletionDateType, "ESTIMATED");
  assert.equal(result.records[0].fields.hasPostedResults, false);
  assert.equal(result.sources[0].publishedAt, "2025-02-03");
  assert.equal(result.sources[0].retrievedAt, retrievedAt);
  assert.equal(result.sources[0].contentKind, "metadata");
  assert.match(result.coverage, /not FDA review/);
  assert.match(
    result.limitations.join(" "),
    /do not establish endpoint success/,
  );
  assert.equal(result.total, 12);
  assert.equal(result.sources[0].id, result.records[0].sourceId);
  assert.ok(sourceSchema.safeParse(result.sources[0]).success);
  assert.match(result.sources[0].fullText!, /queryUrl/);
});

test("sponsor-only trials work and missing registry values stay unknown", async () => {
  const { options, requests } = fixture([
    {
      studies: [
        { protocolSection: { identificationModule: { nctId: "NCT12345679" } } },
      ],
      totalCount: 1,
    },
  ]);
  const result = await executeEvidenceQuery(
    "trials",
    { sponsor: "Example Sponsor" },
    options,
  );
  assert.equal(requests[0].url.searchParams.has("query.intr"), false);
  assert.equal(result.records[0].fields.hasPostedResults, null);
  assert.deepEqual(result.records[0].fields.enrollment, {
    count: null,
    type: null,
  });
  assert.equal(result.sources[0].publishedAt, null);
});

test("approval lookup gives exact application priority and separates ORIG, supplements, status and document dates", async () => {
  const { options, requests } = fixture([
    { results: [approval], meta: { results: { total: 1 } } },
  ]);
  const result = await executeEvidenceQuery(
    "approvals",
    {
      drug: "Wrong alias",
      applicationNumber: "NDA 210852",
      indication: "new disease",
    },
    options,
  );
  assert.equal(
    requests[0].url.searchParams.get("search"),
    'application_number:"NDA210852"',
  );
  const submissions = result.records[0].fields.submissions as Array<
    Record<string, unknown>
  >;
  assert.equal(submissions[0].type, "ORIG");
  assert.equal(submissions[0].statusDate, "2020-01-02");
  assert.deepEqual(submissions[0].documents, [
    {
      type: "Label",
      documentDate: "2020-01-08",
      url: "https://www.accessdata.fda.gov/drugsatfda_docs/label/example.pdf",
    },
  ]);
  assert.equal(submissions[1].type, "SUPPL");
  assert.equal(result.sources[0].publishedAt, null);
  assert.equal(result.records[0].fields.candidateIndicationMatch, "unverified");
  assert.match(result.limitations.join(" "), /not submission receipt dates/);
  assert.match(result.limitations.join(" "), /indication is not used/);
});

test("numeric application lookup covers NDA/BLA/ANDA prefixes, while drug search includes ingredients", async () => {
  const { options, requests } = fixture([{ results: [] }, { results: [] }]);
  await executeEvidenceQuery(
    "approvals",
    { applicationNumber: "12345" },
    options,
  );
  assert.equal(
    requests[0].url.searchParams.get("search"),
    'application_number:("NDA012345" OR "BLA012345" OR "ANDA012345")',
  );
  await executeEvidenceQuery("approvals", "Drug compound", options);
  assert.match(
    requests[1].url.searchParams.get("search")!,
    /products.active_ingredients.name:"Drug compound"/,
  );
});

test("only openFDA NOT_FOUND is empty; authorization/rate limits/malformed responses fail explicitly", async () => {
  const empty = fixture([
    Response.json(
      { error: { code: "NOT_FOUND", message: "No matches found!" } },
      { status: 404 },
    ),
  ]);
  const result = await executeEvidenceQuery(
    "approvals",
    "MissingDrug",
    empty.options,
  );
  assert.equal(result.total, 0);
  assert.deepEqual(result.records, []);
  assert.match(result.limitations.join(" "), /No match means unknown/);
  for (const response of [
    Response.json({ error: { code: "OTHER" } }, { status: 404 }),
    Response.json({ error: { code: "TOO_MANY_REQUESTS" } }, { status: 429 }),
    Response.json({ broken: true }),
    new Response("not JSON", { status: 200 }),
  ]) {
    await assert.rejects(
      executeEvidenceQuery("approvals", "Drug", fixture([response]).options),
      /HTTP|unexpected|invalid JSON/,
    );
  }
});

test("label discovery preserves SPL scope, does not invent approval or publication dates, and bounds excerpts", async () => {
  const label = {
    id: "label-123",
    set_id: "01234567-89ab-cdef-0123-456789abcdef",
    effective_time: "20250203",
    openfda: { brand_name: ["EXAMPLE"], application_number: ["NDA210852"] },
    indications_and_usage: [
      Array.from({ length: 80 }, (_, i) => `word${i}`).join(" "),
    ],
    boxed_warning: ["Warning text"],
    clinical_studies: ["Trial section"],
  };
  const { options, requests } = fixture([
    { results: [label], meta: { results: { total: 1 } } },
  ]);
  const result = await executeEvidenceQuery(
    "labels",
    { drug: "EXAMPLE", indication: "disease" },
    options,
  );
  assert.equal(requests[0].url.searchParams.get("sort"), "effective_time:desc");
  assert.match(
    requests[0].url.searchParams.get("search")!,
    /indications_and_usage:"disease"/,
  );
  assert.equal(result.sources[0].publishedAt, null);
  const fields = result.records[0].fields;
  assert.equal(fields.labelEffectiveDate, "2025-02-03");
  assert.equal(fields.approvalVerification, "not_determined_by_this_source");
  assert.equal(String(fields.indicationExcerpt).split(/\s+/).length, 25);
  assert.equal(fields.indicationExcerptTruncated, true);
  assert.deepEqual(fields.sectionAvailability, {
    indications_and_usage: true,
    boxed_warning: true,
    contraindications: false,
    warnings_and_cautions: false,
    adverse_reactions: false,
    clinical_studies: true,
    dosage_and_administration: false,
  });
  assert.match(result.limitations.join(" "), /not proof of FDA approval/);
});

test("PubMed searches clinically indexed work and returns linked citation metadata, not inferred study outcomes", async () => {
  const { options, requests } = fixture([
    { esearchresult: { count: "20", idlist: ["12345678"] } },
    {
      result: {
        uids: ["12345678"],
        "12345678": {
          uid: "12345678",
          title: "A trial of exampledrug",
          pubdate: "2025 Sep",
          fulljournalname: "Example Journal",
          pubtype: ["Clinical Trial"],
          authors: [{ name: "Author A" }],
          articleids: [{ idtype: "doi", value: "10.1234/example" }],
        },
      },
    },
  ]);
  const result = await executeEvidenceQuery(
    "publications",
    {
      drug: "exampledrug",
      sponsor: "Sponsor",
      indication: "disease",
      limit: 2,
    },
    options,
  );
  const search = requests[0].url.searchParams.get("term")!;
  assert.match(search, /"exampledrug"\[Title\/Abstract\]/);
  assert.match(search, /clinical trial\[Publication Type\]/);
  assert.doesNotMatch(search, /Sponsor/);
  assert.equal(requests[1].url.searchParams.get("id"), "12345678");
  assert.equal(
    result.sources[0].url,
    "https://pubmed.ncbi.nlm.nih.gov/12345678/",
  );
  assert.equal(result.sources[0].publishedAt, null);
  assert.equal(result.records[0].fields.publicationDate, "2025 Sep");
  assert.equal(result.records[0].fields.abstractRetrieved, false);
  assert.equal(result.records[0].fields.fullTextRetrieved, false);
  assert.equal(result.total, 20);
  assert.ok(sourceSchema.safeParse(result.sources[0]).success);
});

test("empty PubMed search does not issue a citation request", async () => {
  const { options, requests } = fixture([
    { esearchresult: { count: "0", idlist: [] } },
  ]);
  const result = await executeEvidenceQuery(
    "publications",
    "missingdrug",
    options,
  );
  assert.equal(requests.length, 1);
  assert.deepEqual(result.records, []);
});

test("query validation rejects unsupported identities without making a request", async () => {
  const { options, requests } = fixture([]);
  await assert.rejects(executeEvidenceQuery("trials", "", options), /Provide/);
  await assert.rejects(
    executeEvidenceQuery("trials", "a".repeat(241), options),
    /240/,
  );
  await assert.rejects(
    executeEvidenceQuery("approvals", { indication: "disease" }, options),
    /indication alone/,
  );
  await assert.rejects(
    executeEvidenceQuery(
      "approvals",
      { applicationNumber: "NDA123 OR *" },
      options,
    ),
    /application number/,
  );
  await assert.rejects(
    executeEvidenceQuery("publications", { sponsor: "Sponsor" }, options),
    /requires a drug or indication/,
  );
  await assert.rejects(
    executeEvidenceQuery("trials", { drug: "drug", limit: 0 }, options),
    /positive integer/,
  );
  assert.equal(requests.length, 0);
});

test("result count, nested records, and duplicate source IDs remain bounded", async () => {
  const many = Array.from({ length: 20 }, () => trial);
  const result = await executeEvidenceQuery(
    "trials",
    { drug: "drug", limit: 2 },
    fixture([{ studies: many, totalCount: 20 }]).options,
  );
  assert.equal(result.records.length, 1);
  assert.equal(result.sources.length, 1);
  const manySubmissions = {
    ...approval,
    submissions: Array.from({ length: 50 }, (_, i) => ({
      submission_type: i === 49 ? "ORIG" : "SUPPL",
      submission_number: String(i),
      submission_status_date: "20200101",
    })),
  };
  const applicationResult = await executeEvidenceQuery(
    "approvals",
    "drug",
    fixture([{ results: [manySubmissions] }]).options,
  );
  assert.equal(
    (applicationResult.records[0].fields.submissions as unknown[]).length,
    12,
  );
  assert.equal(applicationResult.records[0].fields.submissionsTotal, 50);
});

test("oversized bodies are bounded even when Content-Length is absent", async () => {
  for (const response of [
    new Response("{}", {
      headers: { "Content-Length": String(5 * 1024 * 1024) },
    }),
    new Response("x".repeat(4 * 1024 * 1024 + 1)),
  ]) {
    await assert.rejects(
      executeEvidenceQuery("trials", "drug", fixture([response]).options),
      /4 MiB/,
    );
  }
});

test("slow requests time out rather than returning a false empty result", async () => {
  const options: EvidenceOptions = {
    timeoutMs: 5,
    fetch: async (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new Error("aborted")),
          { once: true },
        );
      }),
  };
  await assert.rejects(
    executeEvidenceQuery("trials", "drug", options),
    /timed out after 5 ms/,
  );
});

test("caller cancellation aborts an in-flight public API request and remains distinct from timeout", async () => {
  const controller = new AbortController();
  let upstreamAborted = false;
  const options: EvidenceOptions = {
    signal: controller.signal,
    timeoutMs: 10_000,
    fetch: async (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => {
            upstreamAborted = true;
            reject(init.signal?.reason);
          },
          { once: true },
        );
        controller.abort();
      }),
  };
  await assert.rejects(executeEvidenceQuery("trials", "drug", options), {
    name: "AbortError",
  });
  assert.equal(upstreamAborted, true);
});

test("cancelling after PubMed discovery prevents the second citation request", async () => {
  const controller = new AbortController();
  let requests = 0;
  await assert.rejects(
    executeEvidenceQuery("publications", "drug", {
      signal: controller.signal,
      fetch: async () => {
        requests++;
        controller.abort();
        return Response.json({
          esearchresult: { count: "1", idlist: ["12345678"] },
        });
      },
    }),
    { name: "AbortError" },
  );
  assert.equal(requests, 1);
});

test("concurrent PubMed callers share request pacing and keep rate-limit failures visible", async () => {
  const started: number[] = [];
  const options: EvidenceOptions = {
    fetch: async () => {
      started.push(Date.now());
      return Response.json({ esearchresult: { count: "0", idlist: [] } });
    },
  };
  await Promise.all(
    Array.from({ length: 4 }, () =>
      executeEvidenceQuery("publications", "drug", options),
    ),
  );
  for (let i = 1; i < started.length; i++)
    assert.ok(
      started[i] - started[i - 1] >= 330,
      "Concurrent requests must stay below three per second",
    );
  const limited = fixture([
    Response.json({ error: "API rate limit exceeded" }, { status: 429 }),
  ]);
  await assert.rejects(
    executeEvidenceQuery("publications", "drug", limited.options),
    /HTTP 429/,
  );
});
