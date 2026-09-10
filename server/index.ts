import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { timingSafeEqual } from "node:crypto";
import { config, runtimeInfo } from "./config.js";
import {
  getCatalog,
  getModel,
  listInvestigations,
  getInvestigation,
  getAssessments,
  getTrialVisuals,
} from "./data.js";
import { investigate } from "./investigate.js";
import {
  readDossier,
  listDossiers,
  gatherDossier,
  publicDossier,
} from "./dossier.js";
import { z } from "zod";

const loopback = ["127.0.0.1", "localhost", "::1"].includes(config.host);
if (!loopback && !config.accessToken)
  throw Error(
    "Set RADAR_ACCESS_TOKEN before binding a paid runtime to a public interface.",
  );
const requestSchema = z
  .object({
    candidateId: z
      .string()
      .regex(/^[a-zA-Z0-9_-]+$/)
      .max(100),
    question: z.string().max(3000).optional(),
    mode: z.enum(["investigate", "challenge"]).optional(),
    previousRunId: z.string().max(100).optional(),
  })
  .strict();
let activeRuns = 0;
function json(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(value));
}
async function body(req: IncomingMessage) {
  let text = "";
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 16_000) throw Error("Request body exceeds 16 KB.");
  }
  return JSON.parse(text);
}
function authorized(req: IncomingMessage) {
  if (!config.accessToken) return loopback;
  const value = String(req.headers.authorization || "").replace(/^Bearer /, "");
  const a = Buffer.from(value),
    b = Buffer.from(config.accessToken);
  return a.length === b.length && timingSafeEqual(a, b);
}
const server = createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  try {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.pathname === "/api/health")
      return json(res, 200, { ok: true, model: config.model });
    if (req.method === "GET" && url.pathname === "/api/dashboard") {
      const [catalog, model, runs] = await Promise.all([
        getCatalog(),
        getModel(),
        listInvestigations(),
      ]);
      const visibleRuns = runs.filter(
        (r) => authorized(req) || r.provenance === "recorded",
      );
      const evidenceCandidateIds = await listDossiers(!authorized(req));
      const evidenceSourcesByCandidate = Object.fromEntries(
        await Promise.all(
          catalog.candidates.map(async (candidate) => {
            const dossier = evidenceCandidateIds.includes(candidate.id)
              ? await readDossier(candidate.id, !authorized(req))
              : null;
            const sources = [
              ...visibleRuns
                .filter((run) => run.candidateId === candidate.id)
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                .flatMap((run) => run.sources),
              ...(dossier ? publicDossier(dossier).sources : []),
            ];
            return [
              candidate.id,
              [
                ...new Map(
                  sources.map((source) => [source.id, source]),
                ).values(),
              ],
            ];
          }),
        ),
      );
      return json(res, 200, {
        catalog,
        model,
        runtime: runtimeInfo(),
        assessments: await getAssessments(catalog, visibleRuns),
        trialVisuals: await getTrialVisuals(catalog, visibleRuns),
        evidenceCandidateIds,
        evidenceSourcesByCandidate,
        investigations: visibleRuns.map(
          ({
            id,
            candidateId,
            model,
            createdAt,
            mode,
            provenance,
            summary,
          }) => ({
            id,
            candidateId,
            model,
            createdAt,
            mode,
            provenance,
            summary,
          }),
        ),
      });
    }
    if (url.pathname.startsWith("/api/evidence/")) {
      const id = url.pathname.split("/").pop() || "";
      const candidate = (await getCatalog()).candidates.find(
        (c) => c.id === id,
      );
      if (!candidate) return json(res, 404, { error: "Candidate not found." });
      if (req.method === "GET") {
        const dossier = await readDossier(id, !authorized(req));
        return json(
          res,
          dossier ? 200 : 404,
          dossier
            ? publicDossier(dossier)
            : {
                error:
                  "No evidence scan has been gathered for this candidate yet.",
              },
        );
      }
      if (req.method === "POST") {
        if (!authorized(req))
          return json(res, 401, {
            error: "Evidence gathering requires the configured access token.",
          });
        const origin = req.headers.origin;
        if (
          origin &&
          !["localhost", "127.0.0.1", "[::1]"].includes(
            new URL(origin).hostname,
          ) &&
          !config.accessToken
        )
          return json(res, 403, {
            error: "Cross-site evidence requests are not allowed.",
          });
        const abort = new AbortController();
        const timer = setTimeout(() => abort.abort(), 2 * 60_000);
        res.on("close", () => {
          if (!res.writableEnded) abort.abort();
        });
        try {
          return json(
            res,
            200,
            publicDossier(
              await gatherDossier(candidate, undefined, {
                refresh: true,
                signal: abort.signal,
              }),
            ),
          );
        } finally {
          clearTimeout(timer);
        }
      }
      return json(res, 405, { error: "Method not allowed." });
    }
    if (req.method === "GET" && url.pathname.startsWith("/api/candidates/")) {
      const id = url.pathname.split("/").pop(),
        catalog = await getCatalog(),
        candidate = catalog.candidates.find((c) => c.id === id);
      if (!candidate) return json(res, 404, { error: "Candidate not found." });
      return json(res, 200, {
        candidate,
        sources: catalog.sources.filter((s) =>
          candidate.sourceIds.includes(s.id),
        ),
        investigations: (await listInvestigations()).filter(
          (r) =>
            r.candidateId === id &&
            (authorized(req) || r.provenance === "recorded"),
        ),
      });
    }
    if (
      req.method === "GET" &&
      url.pathname.startsWith("/api/investigations/")
    ) {
      const found = await getInvestigation(url.pathname.split("/").pop() || "");
      const run =
        found && (authorized(req) || found.provenance === "recorded")
          ? found
          : null;
      return json(
        res,
        run ? 200 : 404,
        run || { error: "Investigation not found." },
      );
    }
    if (req.method === "POST" && url.pathname === "/api/investigate") {
      if (!authorized(req))
        return json(res, 401, {
          error: "Live investigation requires the configured access token.",
        });
      const origin = req.headers.origin;
      if (
        origin &&
        !["localhost", "127.0.0.1", "[::1]"].includes(
          new URL(origin).hostname,
        ) &&
        !config.accessToken
      )
        return json(res, 403, {
          error: "Cross-site research requests are not allowed.",
        });
      if (!config.apiKey)
        return json(res, 503, {
          error: "Astra is not configured. Set ASTRA_API_KEY in .env.local.",
        });
      const args = requestSchema.parse(await body(req));
      if (activeRuns >= 2)
        return json(res, 429, {
          error:
            "Two investigations are already running. Please wait for a run to complete.",
        });
      activeRuns++;
      res.writeHead(200, {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      });
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), 8 * 60_000);
      res.on("close", () => {
        if (!res.writableEnded) abort.abort();
      });
      const emit = (event: Record<string, unknown>) => {
        if (!res.destroyed) res.write(JSON.stringify(event) + "\n");
      };
      try {
        await investigate(args, emit, abort.signal);
      } catch (e) {
        emit({ type: "error", message: safeError(e) });
      } finally {
        clearTimeout(timer);
        activeRuns--;
        res.end();
      }
      return;
    }
    if (url.pathname.startsWith("/api/"))
      return json(res, 404, { error: "API route not found." });
    if (req.method !== "GET")
      return json(res, 405, { error: "Method not allowed." });
    const dist = resolve("dist");
    let path = resolve(dist, "." + decodeURIComponent(url.pathname));
    if (path !== dist && !path.startsWith(dist + sep))
      return json(res, 404, { error: "Not found." });
    try {
      if (!(await stat(path)).isFile()) path = resolve(dist, "index.html");
    } catch {
      path = resolve(dist, "index.html");
    }
    try {
      const content = await readFile(path);
      const types: Record<string, string> = {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".ico": "image/x-icon",
        ".json": "application/json",
      };
      res.writeHead(200, {
        "Content-Type": types[extname(path)] || "application/octet-stream",
      });
      res.end(content);
    } catch {
      return json(res, 404, {
        error: "Run pnpm dev for development or pnpm build before pnpm start.",
      });
    }
  } catch (e) {
    if (!res.headersSent)
      json(res, e instanceof z.ZodError ? 400 : 500, { error: safeError(e) });
    else res.end();
  }
});
function safeError(e: unknown) {
  if (e instanceof z.ZodError)
    return "The request or returned data did not match the expected schema.";
  const message =
    e instanceof Error ? e.message : "Unexpected request failure.";
  return message
    .replace(/(?:sk|fc)-[A-Za-z0-9_-]{12,}/g, "[redacted]")
    .slice(0, 600);
}
server.listen(config.port, config.host, () =>
  console.log(
    `Approval Radar API: http://${config.host}:${config.port} · ${config.model} · ${config.apiKey ? "configured" : "not configured"}`,
  ),
);
