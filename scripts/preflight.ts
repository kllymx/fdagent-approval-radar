import OpenAI from "openai";
import { config } from "../server/config.js";
if (!config.apiKey)
  throw Error(
    "Set ASTRA_API_KEY in .env.local or ASTRA_ENV_FILE pointing to a local credential file.",
  );
if (!config.model.startsWith("gpt-6-astra"))
  throw Error("This preflight requires Astra; no silent model substitution.");
const client = new OpenAI({
  apiKey: config.apiKey,
  baseURL: config.baseUrl,
  timeout: 120_000,
  maxRetries: 0,
});
const started = Date.now();
const response = await client.responses.create({
  model: config.model,
  store: false,
  reasoning: { effort: "low" },
  max_output_tokens: 256,
  input: "Reply with exactly ASTRA_READY.",
});
console.log(
  JSON.stringify(
    {
      requestedModel: config.model,
      returnedModel: response.model,
      status: response.status,
      output: response.output_text,
      latencyMs: Date.now() - started,
      usage: response.usage,
    },
    null,
    2,
  ),
);
