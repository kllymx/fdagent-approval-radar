import { config as dotenv } from "dotenv";
import { resolve } from "node:path";
dotenv({ path: resolve(".env.local"), quiet: true });
dotenv({ path: resolve(".env"), quiet: true });
if (process.env.ASTRA_ENV_FILE)
  dotenv({ path: process.env.ASTRA_ENV_FILE, quiet: true });

export const config = {
  port: Number(process.env.PORT || 8788),
  host: process.env.HOST || "127.0.0.1",
  apiKey: process.env.ASTRA_API_KEY || process.env.OPENAI_API_KEY || "",
  baseUrl:
    process.env.ASTRA_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    "https://api.openai.com/v1",
  model: process.env.ASTRA_MODEL || "gpt-6-astra",
  reasoningEffort: process.env.ASTRA_REASONING_EFFORT || "high",
  firecrawlKey: process.env.FIRECRAWL_API_KEY || "",
  accessToken: process.env.RADAR_ACCESS_TOKEN || "",
  root: process.cwd(),
};
export function runtimeInfo() {
  return {
    configured: Boolean(config.apiKey),
    fdagent: Boolean(process.env.FDAGENT_MCP_ENTRY),
    model: config.model,
    provider: new URL(config.baseUrl).hostname,
    status: config.apiKey ? "ready" : "unconfigured",
    message: config.apiKey
      ? "Live Astra investigations available."
      : "Add ASTRA_API_KEY to .env.local to run live investigations. Public evidence and recorded runs remain available.",
  };
}
