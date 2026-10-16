import type { IncomingMessage, ServerResponse } from "node:http";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type LanguageModel } from "ai";
import { loadEnv, type Connect, type Plugin } from "vite";

export type Provider = "google" | "anthropic" | "openai" | "ollama";

interface ChatBody {
  provider: Provider;
  model: string;
  apiKey?: string;
  system: string;
  prompt: string;
}

const MAX_BODY = 200_000;

/** Vite plugin that serves Plazai's tiny local API: GET /api/status and POST /api/chat. */
export function plazaiApi(): Plugin {
  let env: Record<string, string> = {};
  const attach = (middlewares: Connect.Server) => {
    middlewares.use((req, res, next) => void handle(req, res, next, env));
  };
  return {
    name: "plazai-api",
    configResolved(config) {
      env = { ...loadEnv(config.mode, config.root, ""), ...pick(process.env) };
    },
    configureServer: (server) => attach(server.middlewares),
    configurePreviewServer: (server) => attach(server.middlewares),
  };
}

function pick(e: NodeJS.ProcessEnv) {
  return Object.fromEntries(Object.entries(e).filter((kv): kv is [string, string] => typeof kv[1] === "string"));
}

async function handle(req: IncomingMessage, res: ServerResponse, next: () => void, env: Record<string, string>) {
  const url = req.url ?? "";
  if (!url.startsWith("/api/")) return next();

  // Only the Plazai page itself may use the API: other websites open in your browser can't
  // spend your keys (checks the Host header against DNS rebinding and the Origin against CSRF).
  const host = req.headers.host ?? "";
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) return json(res, 403, { error: "Forbidden" });
  const origin = req.headers.origin;
  if (origin && origin !== `http://${host}`) return json(res, 403, { error: "Forbidden" });

  if (url === "/api/status" && req.method === "GET") {
    return json(res, 200, {
      env: {
        google: Boolean(env.GOOGLE_GENERATIVE_AI_API_KEY),
        anthropic: Boolean(env.ANTHROPIC_API_KEY),
        openai: Boolean(env.OPENAI_API_KEY),
      },
      ollama: await ollamaModels(env),
    });
  }

  if (url === "/api/chat" && req.method === "POST") {
    let body: ChatBody;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return json(res, 400, { error: "Invalid request" });
    }
    const model = resolveModel(body, env);
    if (!model) return json(res, 409, { error: `No API key for ${body.provider}. Add one in Settings or .env.` });

    res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
    const abort = new AbortController();
    res.on("close", () => abort.abort());
    try {
      const result = streamText({
        model,
        system: String(body.system ?? "").slice(0, 8_000),
        prompt: String(body.prompt ?? "").slice(0, 60_000),
        maxOutputTokens: 1_200,
        abortSignal: abort.signal,
      });
      for await (const chunk of result.textStream) res.write(chunk);
    } catch (e) {
      if (!abort.signal.aborted) res.write(`\n\n[error] ${friendly(e)}`);
    }
    return res.end();
  }

  json(res, 404, { error: "Not found" });
}

function resolveModel(b: ChatBody, env: Record<string, string>): LanguageModel | null {
  const key = (k: string) => (b.apiKey?.trim() || env[k] || "").trim();
  switch (b.provider) {
    case "google":
      return key("GOOGLE_GENERATIVE_AI_API_KEY") ? createGoogleGenerativeAI({ apiKey: key("GOOGLE_GENERATIVE_AI_API_KEY") })(b.model) : null;
    case "anthropic":
      return key("ANTHROPIC_API_KEY") ? createAnthropic({ apiKey: key("ANTHROPIC_API_KEY") })(b.model) : null;
    case "openai":
      return key("OPENAI_API_KEY") ? createOpenAI({ apiKey: key("OPENAI_API_KEY") })(b.model) : null;
    case "ollama":
      return createOpenAI({ baseURL: `${ollamaBase(env)}/v1`, apiKey: "ollama" }).chat(b.model);
    default:
      return null;
  }
}

const ollamaBase = (env: Record<string, string>) => (env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/+$/, "");

async function ollamaModels(env: Record<string, string>): Promise<string[]> {
  try {
    const r = await fetch(`${ollamaBase(env)}/api/tags`, { signal: AbortSignal.timeout(800) });
    if (!r.ok) return [];
    const data = (await r.json()) as { models?: { name: string }[] };
    return (data.models ?? []).map((m) => m.name);
  } catch {
    return [];
  }
}

function friendly(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (/api key|401|unauthor|invalid.*key|permission/i.test(msg)) return "The AI provider rejected the API key.";
  if (/429|rate|quota/i.test(msg)) return "The AI provider's rate limit or quota was reached.";
  if (/ECONNREFUSED|fetch failed/i.test(msg)) return "Couldn't reach the model. Is Ollama running?";
  if (/model/i.test(msg) && /not.*found|does not exist|unknown/i.test(msg)) return "That model isn't available for this provider.";
  return "The AI provider returned an error.";
}

function readBody(req: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("too large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(data));
}
