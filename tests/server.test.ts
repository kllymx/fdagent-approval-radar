import assert from "node:assert/strict";
import { test } from "node:test";
import { validateReport } from "../server/investigate.js";
import {
  crlQuery,
  onDomain,
  publicHttpsUrl,
  sourceWindows,
  ResearchSession,
} from "../server/tools.js";
import {
  reportSchema,
  type Report,
  type Source,
  type Candidate,
  type Catalog,
} from "../shared/schema.js";
import { gatherDossier, readDossier } from "../server/dossier.js";
import { queryFDAgent } from "../server/fdagent.js";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";

// All fixtures are local unit-test inputs. Upstream APIs and paid models are never called.
const source: Source = {
  id: "fda-reference",
  title: "FDA source fixture",
  url: "https://www.fda.gov/reference",
  publisher: "FDA",
  publishedAt: null,
  retrievedAt: "2026-09-10T12:00:00Z",
  kind: "fda",
  summary: "A source used solely to test reference validation.",
};
test("find_in_source preserves citation-metadata scope when a title contains the searched phrase", async () => {
  const metadata: Source = {
    ...source,
    id: "evidence-publications-123",
    kind: "publication",
    contentKind: "metadata",
    fullText: JSON.stringify({
      title: "An efficacy result",
      abstractRetrieved: false,
    }),
  };
  const session = new ResearchSession(
    { sourceIds: [metadata.id] } as Candidate,
    { sources: [metadata] } as Catalog,
  );
  const result = (await session.execute("find_in_source", {
    sourceId: metadata.id,
    query: "efficacy result",
  })) as { coverage: string; totalMatches: number };
  assert.equal(result.totalMatches, 1);
  assert.match(result.coverage, /Normalized database metadata only/);
  assert.match(result.coverage, /not the full publication/);
});

test("cancelled research sessions and FDAgent calls reject before starting any work", async () => {
  const controller = new AbortController();
  controller.abort();
  const session = new ResearchSession(
    { sourceIds: [] } as unknown as Candidate,
    { sources: [] } as unknown as Catalog,
    controller.signal,
  );
  await assert.rejects(
    session.execute("query_fdagent", {
      dataset: "facility",
      query: "1234567890",
    }),
    { name: "AbortError" },
  );
  await assert.rejects(
    queryFDAgent("facility", "1234567890", { signal: controller.signal }),
    { name: "AbortError" },
  );
});

test("one cancelled dossier subscriber does not cancel another subscriber's shared scan", async () => {
  const originalFetch = globalThis.fetch;
  const originalEntry = process.env.FDAGENT_MCP_ENTRY;
  delete process.env.FDAGENT_MCP_ENTRY;
  const candidate = {
    id: `test-cancel-${randomUUID()}`,
    drug: "FixtureDrug",
    sponsor: "FixtureSponsor",
    nctIds: [],
  } as unknown as Candidate;
  const controller = new AbortController();
  const signals: AbortSignal[] = [];
  let started!: () => void;
  const firstRequest = new Promise<void>((resolve) => {
    started = resolve;
  });
  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  globalThis.fetch = async (input, init) => {
    if (init?.signal) signals.push(init.signal);
    started();
    await hold;
    init?.signal?.throwIfAborted();
    const url = new URL(String(input));
    return Response.json(
      url.hostname === "clinicaltrials.gov"
        ? { studies: [], totalCount: 0 }
        : url.hostname === "api.fda.gov"
          ? { results: [], meta: { results: { total: 0 } } }
          : { esearchresult: { count: "0", idlist: [] } },
    );
  };
  try {
    const first = gatherDossier(candidate, undefined, {
      signal: controller.signal,
      refresh: true,
    });
    const rejected = assert.rejects(first, { name: "AbortError" });
    await firstRequest;
    // Read the cache and join the existing scan before aborting its first subscriber.
    let joined!: () => void;
    const joinedScan = new Promise<void>((resolve) => {
      joined = resolve;
    });
    const second = gatherDossier(
      candidate,
      (message) => {
        if (message.startsWith("Joining")) joined();
      },
      { refresh: true },
    );
    await joinedScan;
    controller.abort();
    await rejected;
    assert.ok(
      signals.every((signal) => !signal.aborted),
      "The shared upstream requests still have an active subscriber",
    );
    release();
    const completed = await second;
    assert.equal(completed.candidateId, candidate.id);
    assert.ok(completed.families.every((family) => family.status !== "error"));
    assert.equal(
      signals.length,
      4,
      "Both subscribers share a single set of requests",
    );
    assert.equal((await readDossier(candidate.id))?.candidateId, candidate.id);
  } finally {
    release();
    globalThis.fetch = originalFetch;
    if (originalEntry === undefined) delete process.env.FDAGENT_MCP_ENTRY;
    else process.env.FDAGENT_MCP_ENTRY = originalEntry;
    await rm(`.cache/evidence/${candidate.id}.json`, { force: true });
  }
});

function groundedReport(): Report {
  return {
    summary: "The available evidence leaves the final decision unresolved.",
    outlook: {
      verdict: "Evidence remains incomplete.",
      timing: "An action target does not establish approval.",
      probability: null,
      probabilityBasis:
        "No validated individual approval probability is available.",
    },
    findings: [
      {
        id: "finding-1",
        title: "Evidence has a source",
        detail: "Review the referenced evidence.",
        direction: "unknown",
        sourceIds: [source.id],
      },
    ],
    analogs: [
      {
        title: "A referenced review history",
        relevance: "A similar review sequence.",
        difference: "Clinical similarity has not been established.",
        sourceIds: [source.id],
      },
    ],
    nextEvidence: ["A publicly disclosed FDA action."],
    limitations: ["This check verifies IDs, not entailment."],
  };
}

test("accepts a schema-valid report with known references and a withheld probability", () => {
  const report = reportSchema.parse(groundedReport());
  const result = validateReport(report, [source]);
  assert.deepEqual(result.report, report);
  assert.ok(
    result.warnings.some((warning) =>
      /scientific correctness|entailment/.test(warning),
    ),
  );
  assert.equal(result.report.outlook.probability, null);
});

test("diligence and change sections cannot introduce unknown or empty source references", () => {
  const report = groundedReport();
  report.changes = {
    disposition: "revised",
    summary: "A claim changed",
    items: [
      {
        previousClaim: "Prior claim",
        currentClaim: "New claim",
        reason: "New evidence",
        sourceIds: ["unseen-update"],
      },
    ],
  };
  assert.throws(
    () => validateReport(report, [source]),
    /reference does not exist.*unseen-update/,
  );
  report.changes.items[0].sourceIds = [];
  assert.throws(
    () => validateReport(report, [source]),
    /no evidence references/,
  );
  report.changes.items[0].sourceIds = [source.id];
  assert.equal(
    validateReport(report, [source]).report.changes?.disposition,
    "revised",
  );
  report.decisionBrief = {
    pivotalQuestion: "What resolves the question?",
    bullCase: { claim: "Support", sourceIds: [source.id] },
    bearCase: { claim: "Concern", sourceIds: [source.id] },
    decisiveEvidence: {
      question: "Which evidence?",
      whyItMatters: "It distinguishes the cases",
      sourceIds: [source.id],
    },
    scenarios: [
      {
        label: "Conditional scenario",
        trigger: "New result",
        implication: "Reassess",
        sourceIds: ["unseen-scenario"],
      },
    ],
    diligenceQuestions: [],
  };
  assert.throws(
    () => validateReport(report, [source]),
    /reference does not exist.*unseen-scenario/,
  );
});

test("rejects unknown finding references even when other references are valid", () => {
  const report = groundedReport();
  report.findings[0].sourceIds.push("unseen-document");
  assert.throws(
    () => validateReport(report, [source]),
    /reference does not exist.*unseen-document/,
  );
});

test("rejects unknown analog references", () => {
  const report = groundedReport();
  report.analogs[0].sourceIds = ["unseen-history"];
  assert.throws(
    () => validateReport(report, [source]),
    /reference does not exist.*unseen-history/,
  );
});

test("rejects findings and analogs that have no source references", () => {
  for (const section of ["findings", "analogs"] as const) {
    const report = groundedReport();
    report[section][0].sourceIds = [];
    assert.throws(
      () => validateReport(report, [source]),
      /no evidence references/,
      section,
    );
  }
});

test("permits no historical analog when no grounded comparison is available", () => {
  const report = groundedReport();
  report.analogs = [];
  assert.doesNotThrow(() => validateReport(report, [source]));
});

test("rejects unsupported individual probabilities including zero and one", () => {
  for (const probability of [0, 0.5, 1]) {
    const report = groundedReport();
    report.outlook.probability = probability;
    assert.throws(
      () => validateReport(report, [source]),
      /unsupported individual approval probability/,
    );
  }
});

test("public URL parsing permits a public HTTPS government URL", () => {
  const parsed = publicHttpsUrl(
    "https://API.FDA.GOV/drug/drugsfda.json?limit=1",
  );
  assert.equal(parsed.hostname, "api.fda.gov");
  assert.equal(parsed.protocol, "https:");
  assert.equal(parsed.searchParams.get("limit"), "1");
});

test("public URL parsing rejects local, IP, credentialed, and non-HTTPS targets", () => {
  const targets = [
    "http://www.fda.gov/",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "https://localhost/",
    "https://app.localhost/",
    "https://computer.local/",
    "https://127.0.0.1/",
    "https://192.168.1.2/",
    "https://[::1]/",
    "https://2130706433/",
    "https://user:password@www.fda.gov/",
    "https://www.fda.gov:8443/",
    "https://intranet/",
  ];
  for (const target of targets)
    assert.throws(() => publicHttpsUrl(target), { name: "Error" }, target);
});

test("government domain classification accepts exact domains and subdomains", () => {
  assert.equal(onDomain("fda.gov", "fda.gov"), true);
  assert.equal(onDomain("api.fda.gov", "fda.gov"), true);
  assert.equal(onDomain("www.accessdata.fda.gov", "fda.gov"), true);
  assert.equal(onDomain("www.sec.gov", "sec.gov"), true);
});

test("government domain classification rejects lookalikes and suffix attacks", () => {
  for (const host of [
    "notfda.gov",
    "fda.gov.example.org",
    "fake-fda.gov",
    "fda-gov.example.org",
  ]) {
    assert.equal(onDomain(host, "fda.gov"), false, host);
  }
  assert.equal(onDomain("notsec.gov", "sec.gov"), false);
  assert.equal(
    onDomain("clinicaltrials.gov.attacker.example", "clinicaltrials.gov"),
    false,
  );
});

test("numeric CRL queries include NDA and BLA prefixes used by the FDA archive", () => {
  assert.equal(
    crlQuery("210852"),
    'application_number:("NDA 210852" OR "BLA 210852")',
  );
  assert.equal(
    crlQuery(" 12345 "),
    'application_number:("NDA 12345" OR "BLA 12345")',
  );
});

test("company CRL queries retain company identity inside a quoted field", () => {
  assert.equal(
    crlQuery(" Dr. Reddy’s Laboratories, Inc "),
    'company_name:"Dr. Reddy’s Laboratories, Inc"',
  );
  const query = crlQuery('A "quoted" \\ company');
  assert.equal(query, 'company_name:"A quoted  company"');
  assert.equal((query.match(/"/g) || []).length, 2);
});

test("source search is case-insensitive but treats regex punctuation literally", () => {
  const content =
    "Prefix. An endpoint (A+B) is listed; another aab endpoint is different. Suffix.";
  const result = sourceWindows(content, "ENDPOINT (a+b)");
  assert.equal(result.totalMatches, 1);
  assert.equal(result.excerpts.length, 1);
  assert.equal(result.excerpts[0].text, content);
  assert.equal(result.excerpts[0].pdfPage, null);
});

test("source search preserves original text and offsets beyond the initial read bound", () => {
  const content =
    "Header ".repeat(11_000) +
    "\nDecisive late appendix evidence.\n" +
    "Context ".repeat(200);
  const result = sourceWindows(content, "Decisive late appendix evidence");
  assert.equal(result.totalMatches, 1);
  const excerpt = result.excerpts[0];
  assert.ok(excerpt.start > 65_000);
  assert.equal(excerpt.text, content.slice(excerpt.start, excerpt.end));
  assert.ok(excerpt.text.includes("Decisive late appendix evidence"));
  assert.ok(
    excerpt.end - excerpt.start <=
      1800 + "Decisive late appendix evidence".length,
  );
});

test("source search reports PDF page of each match using preserved form feeds", () => {
  const content =
    "First PDF page.\fSecond PDF page.\fThird page contains COMPLETE RESPONSE.";
  const result = sourceWindows(content, "complete response");
  assert.equal(result.excerpts[0].pdfPage, 3);
  assert.equal(
    result.excerpts[0].text,
    content.slice(result.excerpts[0].start, result.excerpts[0].end),
  );
});

test("source search caps disjoint excerpts while reporting total matches", () => {
  const content = Array.from(
    { length: 8 },
    (_, index) => `Section ${index} decision marker ${"x".repeat(2100)}`,
  ).join("\f");
  const result = sourceWindows(content, "decision marker");
  assert.equal(result.totalMatches, 8);
  assert.equal(result.excerpts.length, 5);
  assert.equal(result.truncatedMatches, true);
  for (let i = 0; i < result.excerpts.length; i++) {
    const excerpt = result.excerpts[i];
    assert.equal(excerpt.text, content.slice(excerpt.start, excerpt.end));
    assert.ok(excerpt.text.includes("decision marker"));
    assert.ok(excerpt.text.length <= 1800 + "decision marker".length);
    if (i > 0) assert.ok(excerpt.start >= result.excerpts[i - 1].end);
  }
});

test("source search distinguishes omitted overlapping matches from no matches", () => {
  const overlapping = sourceWindows(
    "decision marker, decision marker, decision marker",
    "decision marker",
  );
  assert.equal(overlapping.totalMatches, 3);
  assert.equal(overlapping.excerpts.length, 1);
  assert.equal(overlapping.truncatedMatches, true);
  const absent = sourceWindows(
    "No matching phrase in this local fixture.",
    "complete response",
  );
  assert.deepEqual(absent, {
    totalMatches: 0,
    excerpts: [],
    truncatedMatches: false,
  });
  assert.throws(() => sourceWindows("anything", ""), /Empty phrase/);
});
