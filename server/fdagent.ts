/** Optional bridge to an existing FDAgent MCP server; private code stays outside this repo. */
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { isAbsolute } from "node:path";
import { parse } from "dotenv";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Source } from "../shared/schema.js";

export const fdagentTools = {
  inspections: "compliance_inspections",
  warning_letters: "compliance_warning_letters",
  facility: "compliance_facility_overview",
  orange_book: "orange_book_search",
  purple_book: "purple_book_search",
} as const;
export type FDAgentDataset = keyof typeof fdagentTools;
export function fdagentConfigured() {
  return Boolean(process.env.FDAGENT_MCP_ENTRY);
}
export function fdagentArguments(dataset: FDAgentDataset, query: string) {
  if (!Object.hasOwn(fdagentTools, dataset))
    throw Error("Unsupported FDAgent dataset.");
  if (!query.trim() || query.length > 160)
    throw Error("Provide a specific query up to 160 characters.");
  if (dataset === "facility") {
    if (!/^\d{6,12}$/.test(query))
      throw Error("Facility overview requires an exact FDA FEI identifier.");
    return { fei: query };
  }
  return { query: query.trim(), limit: 6 };
}

// Dataset internals, contact details and user annotations are not passed to the research model.
const publicFields = new Set([
  "firmName",
  "firm",
  "companyName",
  "company",
  "name",
  "title",
  "subject",
  "fei",
  "feiNumber",
  "fdaInspectionId",
  "inspectionId",
  "inspectionStartDate",
  "inspectionEndDate",
  "startDate",
  "endDate",
  "date",
  "issueDate",
  "letterDate",
  "actionDate",
  "classification",
  "productType",
  "productTypes",
  "city",
  "state",
  "country",
  "issuingOffice",
  "actionType",
  "center",
  "form483Issued",
  "hasForm483",
  "form483Url",
  "pdfUrl",
  "url",
  "sourceUrl",
  "fdaUrl",
  "source",
  "citation",
  "cfrReference",
  "description",
  "observation",
  "summary",
  "programArea",
  "programAreas",
  "inspectionType",
  "properName",
  "proprietaryName",
  "applicant",
  "applicantName",
  "ingredient",
  "tradeName",
  "applNo",
  "applType",
  "applicationNumber",
  "applicationType",
  "approvalDate",
  "strength",
  "dosageForm",
  "route",
  "teCode",
  "licenseType",
  "marketingStatus",
  "licenseStatus",
  "referenceProduct",
  "exclusivity",
  "productNumber",
  "status",
  "type",
  "eventType",
  "inspections",
  "warningLetters",
  "complianceActions",
  "timeline",
  "events",
  "results",
  "items",
  "identity",
  "facility",
  "location",
  "address",
  "counts",
  "total",
  "returned",
  "totalInspections",
  "totalWarningLetters",
  "totalComplianceActions",
  "form483Count",
  "oaiCount",
  "vaiCount",
  "naiCount",
  "products",
  "approvals",
  "recalls",
  "nonSiteAttributable",
  "siteAttributable",
  "attribution",
  "limitations",
]);
export function publicFDAgentRecord(value: unknown, depth = 0): unknown {
  if (depth > 8) return "Nested detail omitted";
  if (typeof value === "string") return value.slice(0, 1800);
  if (value === null || typeof value === "number" || typeof value === "boolean")
    return value;
  if (Array.isArray(value))
    return value
      .slice(0, 12)
      .map((item) => publicFDAgentRecord(item, depth + 1));
  if (typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => publicFields.has(key))
        .map(([key, child]) => [key, publicFDAgentRecord(child, depth + 1)]),
    );
  return null;
}
function originalUrls(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const urls: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === "string" && /url$/i.test(key)) {
      try {
        const u = new URL(child);
        if (
          u.protocol === "https:" &&
          !u.username &&
          !u.password &&
          /(^|\.)fda\.gov$/.test(u.hostname)
        )
          urls.push(u.href);
      } catch {
        /* non-URL field */
      }
    } else if (child && typeof child === "object")
      urls.push(...originalUrls(child));
  }
  return [...new Set(urls)].slice(0, 8);
}
export async function queryFDAgent(
  dataset: FDAgentDataset,
  query: string,
  options: { signal?: AbortSignal } = {},
) {
  const signal = options.signal;
  signal?.throwIfAborted();
  const args = fdagentArguments(dataset, query);
  const entry = process.env.FDAGENT_MCP_ENTRY;
  if (!entry || !isAbsolute(entry))
    throw Error(
      "FDAgent connector is not configured. Set an absolute FDAGENT_MCP_ENTRY path server-side.",
    );
  const envFile = process.env.FDAGENT_ENV_FILE;
  const settings = envFile ? parse(await readFile(envFile, { signal })) : {};
  signal?.throwIfAborted();
  const env: Record<string, string> = {};
  for (const key of ["CONVEX_URL", "NEXT_PUBLIC_CONVEX_URL", "OPENFDA_API_KEY"])
    if (process.env[key] || settings[key])
      env[key] = process.env[key] || settings[key];
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [entry],
    env,
    stderr: "ignore",
    maxBufferSize: 4_000_000,
  });
  const client = new Client({ name: "approval-radar", version: "0.2.0" });
  let closing: Promise<void> | undefined;
  const close = () =>
    (closing ??= (async () => {
      await client.close().catch(() => {});
      await transport.close().catch(() => {});
    })());
  const onAbort = () => {
    void close();
  };
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    signal?.throwIfAborted();
    await client.connect(transport, { timeout: 15_000, signal });
    signal?.throwIfAborted();
    const result = await client.callTool(
      { name: fdagentTools[dataset], arguments: args },
      undefined,
      { timeout: 45_000, signal },
    );
    signal?.throwIfAborted();
    if (result.isError)
      throw Error(
        "FDAgent data lookup failed; no absence conclusion can be drawn.",
      );
    const content = result.content as { type: string; text?: string }[];
    const text = content
      .filter((block) => block.type === "text")
      .map((block) => block.text || "")
      .join("\n");
    const records = publicFDAgentRecord(JSON.parse(text));
    const retrievedAt = new Date().toISOString();
    const urls = originalUrls(records);
    const sources: Source[] = urls.map((url) => ({
      id:
        "fdagent-" +
        createHash("sha256").update(url).digest("hex").slice(0, 12),
      title: `FDA ${dataset.replaceAll("_", " ")} record discovered through FDAgent`,
      url,
      publisher: "FDA · via FDAgent",
      kind: "fda",
      publishedAt: null,
      retrievedAt,
      summary: `Returned by FDAgent ${fdagentTools[dataset]} for “${query}”. Verify the linked original and the candidate–facility relationship before drawing conclusions.`,
    }));
    return {
      dataset,
      query,
      records,
      sources,
      retrievedAt,
      coverage:
        "Read-only FDAgent regulatory dataset lookup. Names are discovery matches, not confirmed entity or candidate links. An exact FEI identifies a facility, not which products it manufactures. Original-source verification is required. No matches do not establish a clean compliance history.",
      ...(sources.length
        ? {}
        : {
            citationGap:
              "No original FDA document URL returned. These records are research leads, not citable original documents; search for and read the relevant FDA disclosure.",
          }),
    };
  } catch (error) {
    signal?.throwIfAborted();
    throw error;
  } finally {
    signal?.removeEventListener("abort", onAbort);
    await close();
  }
}
