/** Extract official brand assets using Firecrawl's /v2/scrape branding format. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { config } from "../server/config.js";
import { publicHttpsUrl } from "../server/tools.js";
const exec = promisify(execFile);
const sites = JSON.parse(await readFile("data/brand-sites.json", "utf8")) as {
  companies: { id: string; name: string; website: string }[];
  candidateCompanies: Record<string, string[]>;
};
await mkdir(".firecrawl/branding", { recursive: true });
await mkdir("public/brands", { recursive: true });
async function extract(company: (typeof sites.companies)[number]) {
  const sourcePage =
    company.id === "ultragenyx" ? "https://ir.ultragenyx.com" : company.website;
  const file = `.firecrawl/branding/${company.id === "ultragenyx" ? "ultragenyx-investors" : company.id}.json`;
  let raw: any;
  if (!process.argv.includes("--refresh")) {
    try {
      raw = JSON.parse(await readFile(file, "utf8"));
    } catch {
      /* no cache */
    }
  }
  if (!raw) {
    if (config.firecrawlKey) {
      const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.firecrawlKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: sourcePage, formats: ["branding"] }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok)
        throw Error(`Branding HTTP ${response.status} for ${company.id}`);
      raw = await response.json();
      await writeFile(file, JSON.stringify(raw), { mode: 0o600 });
    } else {
      await exec(
        "firecrawl",
        ["scrape", sourcePage, "--format", "branding", "--json", "-o", file],
        { timeout: 140_000, maxBuffer: 500_000 },
      );
      raw = JSON.parse(await readFile(file, "utf8"));
    }
  }
  const brand = raw.data?.branding || raw.branding;
  if (!brand) throw Error(`No branding profile returned for ${company.id}`);
  const logoUrl = brand.images?.logo || null,
    iconUrl = brand.images?.favicon || null;
  const selectedLogo = company.id === "gsk" ? iconUrl : logoUrl || iconUrl;
  const logo = selectedLogo
    ? await asset(selectedLogo, company.id + "-logo").catch((e) => ({
        error: (e as Error).message,
      }))
    : null;
  const selectedIcon = iconUrl || logoUrl;
  const icon = selectedIcon
    ? await asset(selectedIcon, company.id + "-icon").catch((e) => ({
        error: (e as Error).message,
      }))
    : null;
  if (!logo || !("path" in logo) || !icon || !("path" in icon))
    throw Error(
      `Could not retrieve both brand assets for ${company.id}; existing manifest retained.`,
    );
  const background = [
    "scholar-rock",
    "praxis",
    "nuvalent",
    "mineralys",
  ].includes(company.id)
    ? "dark"
    : "light";
  console.log(
    JSON.stringify({
      company: company.id,
      logo: logo && "path" in logo ? logo.path : logo,
      icon: icon && "path" in icon ? icon.path : icon,
    }),
  );
  return {
    ...company,
    logoUrl: logoUrl?.startsWith("data:") ? null : logoUrl,
    iconUrl,
    iconAssetSource: iconUrl
      ? "Official favicon returned by Firecrawl branding"
      : "Official logo reused as compact mark; no favicon returned by Firecrawl branding",
    assetPath: logo && "path" in logo ? logo.path : null,
    iconPath: icon && "path" in icon ? icon.path : null,
    background,
    displayKind:
      ["gsk", "corcept", "exelixis"].includes(company.id) || !logoUrl
        ? "symbol"
        : "wordmark",
    retrievedAt: new Date().toISOString(),
    method: "firecrawl-branding",
    sourcePage,
    assetSource:
      company.id === "gsk"
        ? "Static company mark from Firecrawl branding favicon; animated logo URL retained"
        : !logoUrl
          ? "Official company icon returned by Firecrawl branding; full wordmark unavailable"
          : logoUrl?.startsWith("data:")
            ? "Inline SVG extracted by Firecrawl from the source page"
            : "Logo URL returned by Firecrawl branding",
    logoSha256: logo && "sha256" in logo ? logo.sha256 : null,
    iconSha256: icon && "sha256" in icon ? icon.sha256 : null,
    ...(logo && "error" in logo ? { logoError: logo.error } : {}),
  };
}
async function asset(raw: string, name: string) {
  let bytes: Buffer, type: string;
  if (raw.startsWith("data:image/")) {
    const comma = raw.indexOf(",");
    const head = raw.slice(0, comma);
    type = head.slice(5).split(";")[0];
    bytes = head.includes(";base64")
      ? Buffer.from(raw.slice(comma + 1), "base64")
      : Buffer.from(decodeURIComponent(raw.slice(comma + 1)));
  } else {
    const url = publicHttpsUrl(raw);
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw Error(`Asset HTTP ${response.status}`);
    type = response.headers.get("content-type") || "";
    if (Number(response.headers.get("content-length") || 0) > 2_000_000)
      throw Error("Asset too large");
    if (!response.body) throw Error("Empty brand asset.");
    const reader = response.body.getReader(),
      chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 2_000_000) {
          await reader.cancel();
          throw Error("Asset too large");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    bytes = Buffer.concat(chunks);
  }
  if (bytes.length > 2_000_000) throw Error("Asset too large");
  let svg = bytes.toString("utf8").trim();
  let ext =
    type.includes("svg") || svg.startsWith("<svg") || svg.startsWith("<?xml")
      ? "svg"
      : type.includes("png")
        ? "png"
        : type.includes("jpeg")
          ? "jpg"
          : type.includes("webp")
            ? "webp"
            : type.includes("icon")
              ? "ico"
              : null;
  if (!ext && bytes.length >= 4 && bytes.readUInt32BE(0) === 0x00000100)
    ext = "ico";
  if (!ext) throw Error("Unsupported image content type " + type);
  if (ext === "svg") {
    // Expand only literal Adobe namespace declarations; drawing geometry/colors stay unchanged.
    const namespaces = [
      ...svg.matchAll(
        /<!ENTITY (ns_[a-z_]+) "(http:\/\/ns\.adobe\.com\/[A-Za-z0-9/.]+)">/g,
      ),
    ];
    for (const [, key, value] of namespaces)
      svg = svg.replaceAll("&" + key + ";", value);
    svg = svg.replace(
      /<!ENTITY ns_[a-z_]+ "http:\/\/ns\.adobe\.com\/[A-Za-z0-9/.]+">/g,
      "",
    );
    if (/<!ENTITY/i.test(svg)) throw Error("Unsupported SVG entity.");
    svg = svg
      .replace(/<!DOCTYPE[^[]*\[[\s\S]*?\]>/g, "")
      .replace(/<!DOCTYPE[^>]*>/g, "");
    if (
      /<(script|foreignObject)\b|\bon\w+\s*=|javascript:|(?:href\s*=\s*["'](?:https?:|\/\/))|url\(\s*["']?(?:https?:|\/\/)/i.test(
        svg,
      )
    )
      throw Error("Active or externally linked SVG rejected.");
    bytes = Buffer.from(svg);
  }
  const path = `brands/${name}.${ext}`;
  await writeFile("public/" + path, bytes);
  return { path, sha256: createHash("sha256").update(bytes).digest("hex") };
}
const pending = [...sites.companies],
  companies: any[] = [];
const failures: string[] = [];
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (pending.length) {
      const company = pending.shift()!;
      try {
        companies.push(await extract(company));
      } catch (e) {
        failures.push(company.id);
        console.error(`${company.id}: ${(e as Error).message}`);
      }
    }
  }),
);
companies.sort((a, b) => a.id.localeCompare(b.id));
if (failures.length)
  throw Error("Brand extraction incomplete: " + failures.join(", "));
await writeFile(
  "data/brands.json",
  JSON.stringify(
    {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      attribution:
        "Logos and trademarks belong to their respective companies. Extracted from their official sites through Firecrawl branding for identification, not endorsement.",
      companies,
      candidateCompanies: sites.candidateCompanies,
    },
    null,
    2,
  ) + "\n",
);
