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

  if (url === "/api/github/context" && req.method === "POST") return githubContext(req, res, env);
  if (url === "/api/github/push" && req.method === "POST") return githubPush(req, res, env);

  json(res, 404, { error: "Not found" });
}

// ---------- GitHub (Repo HQ) ----------
// The browser sends the token only to this local server; it is only ever forwarded to the GitHub API.

const REPO_RE = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const NAME_RE = /^[A-Za-z0-9_.-]{1,100}$/;
const BRANCH_RE = /^(?!\/|.*\/\/|.*\.\.|.*\/$|.*\.lock$)[A-Za-z0-9._\/-]{1,120}$/;

class GitHubError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function gh(env: Record<string, string>, token?: string) {
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
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      throw new GitHubError(res.status, data.message ?? `GitHub returned ${res.status}`);
    }
    return (init.raw ? await res.text() : await res.json()) as T;
  };
}

function ghFriendly(e: unknown) {
  if (e instanceof GitHubError) {
    if (e.status === 401) return "GitHub rejected the token. Check it in Settings.";
    if (e.status === 403) return "Your token doesn't have permission for this. It needs Contents (and Pull requests) write access to the repo.";
    if (e.status === 404) return "Repository not found, or your token can't see it.";
    if (e.status === 422) return `GitHub said: ${e.message}`;
    return `GitHub said: ${e.message}`;
  }
  return "Couldn't reach GitHub.";
}

const enc = (path: string) => path.split("/").map(encodeURIComponent).join("/");

async function githubContext(req: IncomingMessage, res: ServerResponse, env: Record<string, string>) {
  let body: { repo?: string; token?: string };
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    return json(res, 400, { error: "Invalid request" });
  }
  const repo = String(body.repo ?? "").trim();
  if (!REPO_RE.test(repo)) return json(res, 400, { error: "Use the form owner/name." });
  const api = gh(env, body.token?.trim() || env.GITHUB_TOKEN || undefined);
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

interface PushBody {
  token?: string;
  mode?: "branch" | "new";
  repo?: string;
  name?: string;
  private?: boolean;
  description?: string;
  branch?: string;
  message?: string;
  pr?: boolean;
  files?: { path: string; content: string }[];
}

async function githubPush(req: IncomingMessage, res: ServerResponse, env: Record<string, string>) {
  let b: PushBody;
  try {
    b = JSON.parse(await readBody(req, 2_000_000));
  } catch {
    return json(res, 400, { error: "Invalid request (or too large)." });
  }
  const token = b.token?.trim() || env.GITHUB_TOKEN;
  if (!token) return json(res, 400, { error: "Add a GitHub token in Settings first." });
  const files = Array.isArray(b.files) ? b.files : [];
  if (!files.length || files.length > 50) return json(res, 400, { error: "Choose between 1 and 50 files." });
  for (const f of files) {
    const p = String(f.path ?? "");
    if (!p || p.startsWith("/") || p.split("/").some((seg) => seg === ".." || seg === "." || seg === "" || seg === ".git") || p.length > 300) {
      return json(res, 400, { error: `That file path isn't allowed: ${p}` });
    }
    if (typeof f.content !== "string" || f.content.length > 1_000_000) return json(res, 400, { error: `${p} is too large.` });
  }
  const message = String(b.message ?? "").trim().slice(0, 200) || "Update from Plazai";
  const api = gh(env, token);

  try {
    let repo: string;
    let branch: string;
    let base: string;
    if (b.mode === "new") {
      const name = String(b.name ?? "").trim();
      if (!NAME_RE.test(name)) return json(res, 400, { error: "Repository names can use letters, numbers, - _ and ." });
      const created = await api<{ full_name: string; default_branch: string }>("/user/repos", {
        method: "POST",
        body: { name, private: Boolean(b.private), description: String(b.description ?? "").slice(0, 300), auto_init: true },
      });
      repo = created.full_name;
      branch = base = created.default_branch;
    } else {
      repo = String(b.repo ?? "").trim();
      branch = String(b.branch ?? "").trim();
      if (!REPO_RE.test(repo)) return json(res, 400, { error: "Use the form owner/name." });
      if (!BRANCH_RE.test(branch)) return json(res, 400, { error: "That branch name isn't valid." });
      base = (await api<{ default_branch: string }>(`/repos/${repo}`)).default_branch;
      if (branch === base) return json(res, 400, { error: `Plazai won't write straight to ${base}. Use a new branch.` });
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
    const parent = await api<{ tree: { sha: string } }>(`/repos/${repo}/git/commits/${ref.object.sha}`);
    const tree = await api<{ sha: string }>(`/repos/${repo}/git/trees`, {
      method: "POST",
      body: { base_tree: parent.tree.sha, tree: files.map((f) => ({ path: f.path, mode: "100644", type: "blob", content: f.content })) },
    });
    const commit = await api<{ sha: string; html_url?: string }>(`/repos/${repo}/git/commits`, {
      method: "POST",
      body: { message, tree: tree.sha, parents: [ref.object.sha] },
    });
    await api(`/repos/${repo}/git/refs/heads/${enc(branch)}`, { method: "PATCH", body: { sha: commit.sha } });

    let url = `https://github.com/${repo}/tree/${enc(branch)}`;
    if (b.mode !== "new" && b.pr) {
      try {
        const pr = await api<{ html_url: string }>(`/repos/${repo}/pulls`, {
          method: "POST",
          body: { title: message, head: branch, base, body: "Made with Plazai 🏝️. Review before merging." },
        });
        url = pr.html_url;
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
