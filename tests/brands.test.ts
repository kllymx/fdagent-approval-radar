import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { getCatalog } from "../server/data.js";

test("every candidate resolves to official Firecrawl branding with local, hash-verified assets", async () => {
  const brands = JSON.parse(await readFile("data/brands.json", "utf8"));
  const catalog = await getCatalog();
  const ids = new Set(brands.companies.map((c: { id: string }) => c.id));
  assert.equal(ids.size, brands.companies.length);
  for (const candidate of catalog.candidates) {
    const companies = brands.candidateCompanies[candidate.id];
    assert.ok(companies?.length, candidate.id);
    for (const id of companies) assert.ok(ids.has(id), id);
  }
  for (const company of brands.companies) {
    assert.equal(company.method, "firecrawl-branding");
    assert.equal(new URL(company.sourcePage).protocol, "https:");
    for (const [pathKey, hashKey] of [
      ["assetPath", "logoSha256"],
      ["iconPath", "iconSha256"],
    ]) {
      const path = company[pathKey];
      assert.match(path, /^brands\/[a-z0-9-]+\.(svg|png|jpg|webp|ico)$/);
      const bytes = await readFile("public/" + path);
      assert.ok(bytes.length > 0 && bytes.length <= 2_000_000);
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        company[hashKey],
      );
      if (path.endsWith(".svg"))
        assert.doesNotMatch(
          bytes.toString("utf8"),
          /<(?:script|foreignObject)\b|\bon\w+\s*=|<!ENTITY|javascript:/i,
        );
    }
  }
});
