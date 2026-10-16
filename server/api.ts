import { randomBytes, timingSafeEqual } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { homedir } from "node:os";
import { join } from "node:path";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type LanguageModel } from "ai";
import { loadEnv, type Connect, type Logger, type Plugin } from "vite";
import { blockedPath } from "../src/paths.ts";

export type Provider = "google" | "anthropic" | "openai" | "ollama";

const MAX_BODY = 200_000;

/** The only environment variables the server reads. Nothing else from your shell is kept. */
const ENV_KEYS = ["GOOGLE_GENERATIVE_AI_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GITHUB_TOKEN", "OLLAMA_BASE_URL", "GITHUB_API_URL"] as const;
const SECRET_KEYS = ["GOOGLE_GENERATIVE_AI_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GITHUB_TOKEN"] as const;
type Env = Partial<Record<(typeof ENV_KEYS)[number], string>>;

/**
 * Vite plugin that serves Plazai's tiny local API (dev and preview).
 *
 * Keys typed into Settings travel with each request from your own browser. Keys in `.env` (or your
 * shell) are only used for requests that carry the Plazai key, which is printed as a link in the
 * terminal you started Plazai from. Other programs or users on your computer can't see it, so they
 * can't borrow your keys or GitHub token.
 */
export function plazaiApi(): Plugin {
  let env: Env = {};
  let sessionKey = "";
  const attach = (middlewares: Connect.Server) => {
    middlewares.use((req, res, next) => {
      handle(req, res, next, env, sessionKey).catch(() => {
        // Never let one bad request take the whole server down.
        if (!res.headersSent) json(res, 500, { error: "Something went wrong." });
        else res.end();
      });
    });
  };
  const announce = (server: { httpServer: { once(e: "listening", cb: () => void): unknown; address(): unknown } | null; config: { logger: Logger } }, host: unknown) => {
    server.httpServer?.once("listening", () => {
      const port = (server.httpServer?.address() as AddressInfo | null)?.port;
      const log = server.config.logger;
      if (!isLoopback(host)) {
        log.warn("\n  ⚠️  Plazai is reachable from your network (--host). Only do this on a network you trust.");
      }
      if (port && SECRET_KEYS.some((k) => env[k])) {
        log.info(`\n  🔑 Keys found in .env. Open this link once so Plazai can use them:\n     http://127.0.0.1:${port}/?plazai-key=${sessionKey}\n`);
      }
    });
  };
  return {
    name: "plazai-api",
    configResolved(config) {
      const loaded: Record<string, string | undefined> = { ...loadEnv(config.mode, config.root, ""), ...process.env };
      env = Object.fromEntries(ENV_KEYS.filter((k) => loaded[k]).map((k) => [k, loaded[k]!]));
      sessionKey = loadSessionKey();
    },
    configureServer(server) {
      attach(server.middlewares);
      announce(server, server.config.server.host);
    },
    configurePreviewServer(server) {
      attach(server.middlewares);
      announce(server, server.config.preview.host);
    },
  };
}

const isLoopback = (host: unknown) => host === undefined || host === "127.0.0.1" || host === "localhost" || host === "::1";

/**
 * A random key that proves a request came from the Plazai page you opened. It lives in a file only
 * your user account can read, so the link keeps working after a restart. Delete the file to rotate it.
 */
function loadSessionKey() {
  const dir = join(homedir(), ".config", "plazai");
  const file = join(dir, "key");
  try {
    const existing = readFileSync(file, "utf8").trim();
    if (/^[A-Za-z0-9_-]{40,}$/.test(existing)) return existing;
  } catch {
    // no key yet
  }
  const key = randomBytes(32).toString("base64url");
  try {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    writeFileSync(file, key, { mode: 0o600 });
    chmodSync(file, 0o600);
  } catch {
    // Read-only home: the key just lasts until the server stops.
  }
  return key;
}

function sameSecret(given: unknown, key: string) {
  if (typeof given !== "string" || !key) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

async function readJson(req: IncomingMessage, max = MAX_BODY): Promise<Record<string, unknown> | null> {
  if (!String(req.headers["content-type"] ?? "").startsWith("application/json")) return null;
  try {
    const body: unknown = JSON.parse(await readBody(req, max));
    return isObject(body) ? body : null;
  } catch {
    return null;
  }
}

async function handle(req: IncomingMessage, res: ServerResponse, next: () => void, env: Env, sessionKey: string) {
  const url = req.url ?? "";
  if (!url.startsWith("/api/")) return next();

  // Only the Plazai page itself may use the API: other websites open in your browser can't
  // spend your keys (checks the Host header against DNS rebinding and the Origin against CSRF).
  const host = req.headers.host ?? "";
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) return json(res, 403, { error: "Forbidden" });
  const origin = req.headers.origin;
  if (origin && origin !== `http://${host}`) return json(res, 403, { error: "Forbidden" });

  // Keys from .env are only for requests carrying the Plazai key (see the terminal link).
  const trusted = sameSecret(req.headers["x-plazai-key"], sessionKey);
  const envFor = (k: (typeof SECRET_KEYS)[number]) => (trusted ? env[k] ?? "" : "");

  if (url === "/api/status" && req.method === "GET") {
    const has = (k: (typeof SECRET_KEYS)[number]) => Boolean(envFor(k));
    return json(res, 200, {
      env: { google: has("GOOGLE_GENERATIVE_AI_API_KEY"), anthropic: has("ANTHROPIC_API_KEY"), openai: has("OPENAI_API_KEY"), github: has("GITHUB_TOKEN") },
      envLocked: !trusted && SECRET_KEYS.some((k) => env[k]),
      ollama: await ollamaModels(env),
    });
  }

  if (url === "/api/chat" && req.method === "POST") {
    const body = await readJson(req);
    if (!body) return json(res, 400, { error: "Invalid request" });
    const provider = str(body.provider);
    const model = resolveModel(provider, str(body.model), str(body.apiKey), envFor, env);
    if (!model) return json(res, 409, { error: `No API key for ${provider || "that provider"}. Add one in Settings or .env.` });

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

  if (url === "/api/github/context" && req.method === "POST") return githubContext(req, res, env, envFor("GITHUB_TOKEN"));
  if (url === "/api/github/push" && req.method === "POST") return githubPush(req, res, env, envFor("GITHUB_TOKEN"));

  json(res, 404, { error: "Not found" });
}

// ---------- GitHub (Repo HQ) ----------
// The browser sends the token only to this local server; it is only ever forwarded to the GitHub API.

const REPO_RE = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const NAME_RE = /^[A-Za-z0-9_.-]{1,100}$/;
const BRANCH_RE = /^(?!\/|.*\/\/|.*\.\.|.*\/$|.*\.lock$|refs\/|heads\/)[A-Za-z0-9._\/-]{1,120}$/i;

class GitHubError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function gh(env: Env, token?: string) {
  const base = (env.GITHUB_API_URL || "https://api.github.com").replace(/\/+$/, "");
  return async <T,>(path: string, init: { method?: string; body?: unknown; raw?: boolean } = {}): Promise<T> => {
    const res = await fetch(`${base}${path}`, {
      method: init.method ?? "GET",
      headers: {
        accept: init.raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "plazai",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(init.body ? { "content-type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: unknown };
      throw new GitHubError(res.status, typeof data.message === "string" ? data.message.slice(0, 200) : `GitHub returned ${res.status}`);
    }
    const text = await res.text();
    if (text.length > 5_000_000) throw new GitHubError(502, "GitHub's reply was too large.");
    return (init.raw ? text : JSON.parse(text)) as T;
  };
}

function ghFriendly(e: unknown) {
  if (e instanceof GitHubError) {
    if (e.status === 401) return "GitHub rejected the token. Check it in Settings.";
    if (e.status === 403) return "Your token doesn't have permission for this. It needs Contents (and Pull requests) write access to the repo.";
    if (e.status === 404) return "Repository not found, or your token can't see it.";
    return `GitHub said: ${e.message}`;
  }
  return "Couldn't reach GitHub.";
}

const enc = (path: string) => path.split("/").map(encodeURIComponent).join("/");

async function githubContext(req: IncomingMessage, res: ServerResponse, env: Env, envToken: string) {
  const body = await readJson(req);
  if (!body) return json(res, 400, { error: "Invalid request" });
  const repo = str(body.repo);
  if (!REPO_RE.test(repo)) return json(res, 400, { error: "Use the form owner/name." });
  const api = gh(env, str(body.token) || envToken || undefined);
  try {
    const info = await api<{ default_branch: string; description: string | null; language: string | null }>(`/repos/${repo}`);
    const [readme, tree] = await Promise.all([
      api<string>(`/repos/${repo}/readme`, { raw: true }).catch(() => ""),
      api<{ tree: { path: string; type: string }[]; truncated: boolean }>(`/repos/${repo}/git/trees/${enc(info.default_branch)}?recursive=1`).catch(() => ({ tree: [], truncated: false })),
    ]);
    const files = tree.tree.filter((t) => t.type === "blob").map((t) => t.path);
    const context = [
      `Repository: ${repo} (default branch ${info.default_branch}${info.language ? `, mostly ${info.language}` : ""})`,
      info.description && `Description: ${info.description}`,
      `Files (${files.length}${tree.truncated || files.length > 250 ? ", list shortened" : ""}):\n${files.slice(0, 250).join("\n")}`,
      readme && `README:\n${readme.slice(0, 6000)}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    json(res, 200, { context, defaultBranch: info.default_branch });
  } catch (e) {
    json(res, 502, { error: ghFriendly(e) });
  }
}

async function githubPush(req: IncomingMessage, res: ServerResponse, env: Env, envToken: string) {
  const b = await readJson(req, 2_000_000);
  if (!b) return json(res, 400, { error: "Invalid request (or too large)." });
  const token = str(b.token) || envToken;
  if (!token) return json(res, 400, { error: "Add a GitHub token in Settings first." });
  const files = Array.isArray(b.files) ? b.files : [];
  if (!files.length || files.length > 50) return json(res, 400, { error: "Choose between 1 and 50 files." });
  const clean: { path: string; content: string }[] = [];
  for (const f of files) {
    if (!isObject(f) || typeof f.path !== "string" || typeof f.content !== "string") return json(res, 400, { error: "Invalid file." });
    const why = blockedPath(f.path);
    if (why) return json(res, 400, { error: `${f.path.slice(0, 120)} ${why}, so Plazai won't upload it.` });
    if (f.content.length > 1_000_000) return json(res, 400, { error: `${f.path} is too large.` });
    clean.push({ path: f.path, content: f.content });
  }
  const message = str(b.message).slice(0, 200) || "Update from Plazai";
  const api = gh(env, token);

  try {
    let repo: string;
    let branch: string;
    let base: string;
    if (b.mode === "new") {
      const name = str(b.name);
      if (!NAME_RE.test(name)) return json(res, 400, { error: "Repository names can use letters, numbers, - _ and ." });
      const created = await api<{ full_name: string; default_branch: string }>("/user/repos", {
        method: "POST",
        // Private unless the request explicitly says otherwise.
        body: { name, private: b.private !== false, description: str(b.description).slice(0, 300), auto_init: true },
      });
      if (!REPO_RE.test(created.full_name)) throw new GitHubError(502, "Unexpected reply from GitHub.");
      repo = created.full_name;
      branch = base = created.default_branch;
    } else {
      repo = str(b.repo);
      branch = str(b.branch);
      if (!REPO_RE.test(repo)) return json(res, 400, { error: "Use the form owner/name." });
      if (!BRANCH_RE.test(branch)) return json(res, 400, { error: "That branch name isn't valid." });
      base = (await api<{ default_branch: string }>(`/repos/${repo}`)).default_branch;
      if (branch.toLowerCase() === base.toLowerCase()) return json(res, 400, { error: `Plazai won't write straight to ${base}. Use a new branch.` });
      const head = await api<{ object: { sha: string } }>(`/repos/${repo}/git/ref/heads/${enc(base)}`);
      try {
        await api(`/repos/${repo}/git/refs`, { method: "POST", body: { ref: `refs/heads/${branch}`, sha: head.object.sha } });
      } catch (e) {
        // An existing branch is fine: we add a commit on top of it.
        if (!(e instanceof GitHubError && e.status === 422)) throw e;
      }
    }

    // One commit with every file: blobs → tree → commit → move the branch.
    const ref = await api<{ object: { sha: string } }>(`/repos/${repo}/git/ref/heads/${enc(branch)}`);
    const parent = await api<{ tree: { sha: string } }>(`/repos/${repo}/git/commits/${enc(ref.object.sha)}`);
    const tree = await api<{ sha: string }>(`/repos/${repo}/git/trees`, {
      method: "POST",
      body: { base_tree: parent.tree.sha, tree: clean.map((f) => ({ path: f.path, mode: "100644", type: "blob", content: f.content })) },
    });
    const commit = await api<{ sha: string }>(`/repos/${repo}/git/commits`, {
      method: "POST",
      body: { message, tree: tree.sha, parents: [ref.object.sha] },
    });
    await api(`/repos/${repo}/git/refs/heads/${enc(branch)}`, { method: "PATCH", body: { sha: commit.sha } });

    let url = `https://github.com/${repo}/tree/${enc(branch)}`;
    if (b.mode !== "new" && b.pr === true) {
      try {
        const pr = await api<{ html_url: string }>(`/repos/${repo}/pulls`, {
          method: "POST",
          body: { title: message, head: branch, base, body: "Made with Plazai 🏝️. Review before merging." },
        });
        if (/^https:\/\/github\.com\//.test(pr.html_url)) url = pr.html_url;
      } catch (e) {
        // A PR for this branch may already exist; the commit still landed.
        if (!(e instanceof GitHubError && e.status === 422)) throw e;
      }
    }
    json(res, 200, { ok: true, repo, branch, commit: commit.sha, url });
  } catch (e) {
    json(res, 502, { error: ghFriendly(e) });
  }
}

function resolveModel(provider: string, model: string, apiKey: string, envFor: (k: (typeof SECRET_KEYS)[number]) => string, env: Env): LanguageModel | null {
  if (!model || model.length > 200) return null;
  const key = (k: (typeof SECRET_KEYS)[number]) => apiKey || envFor(k);
  switch (provider) {
    case "google":
      return key("GOOGLE_GENERATIVE_AI_API_KEY") ? createGoogleGenerativeAI({ apiKey: key("GOOGLE_GENERATIVE_AI_API_KEY") })(model) : null;
    case "anthropic":
      return key("ANTHROPIC_API_KEY") ? createAnthropic({ apiKey: key("ANTHROPIC_API_KEY") })(model) : null;
    case "openai":
      return key("OPENAI_API_KEY") ? createOpenAI({ apiKey: key("OPENAI_API_KEY") })(model) : null;
    case "ollama":
      return createOpenAI({ baseURL: `${ollamaBase(env)}/v1`, apiKey: "ollama" }).chat(model);
    default:
      return null;
  }
}

const ollamaBase = (env: Env) => (env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/+$/, "");

async function ollamaModels(env: Env): Promise<string[]> {
  try {
    const r = await fetch(`${ollamaBase(env)}/api/tags`, { signal: AbortSignal.timeout(800) });
    if (!r.ok) return [];
    const data = (await r.json()) as { models?: { name?: unknown }[] };
    return (data.models ?? []).map((m) => m.name).filter((n): n is string => typeof n === "string").slice(0, 200);
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

function readBody(req: IncomingMessage, max = MAX_BODY) {
  return new Promise<string>((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > max) {
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
