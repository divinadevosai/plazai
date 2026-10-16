import { useEffect, useState } from "react";
import type { Nav } from "../App";
import { useStore } from "../store";
import type { Provider, Settings } from "../types";
import { ScreenFrame } from "./Chrome";

interface Status {
  env: Record<Exclude<Provider, "ollama">, boolean>;
  ollama: string[];
}

const PROVIDERS: { id: Settings["provider"]; name: string; blurb: string; keyUrl?: string }[] = [
  { id: "demo", name: "Demo", blurb: "Scripted answers, no key needed. Great for a first look." },
  { id: "google", name: "Google Gemini", blurb: "Has a generous free tier.", keyUrl: "https://aistudio.google.com/apikey" },
  { id: "anthropic", name: "Anthropic Claude", blurb: "Thoughtful, great at writing.", keyUrl: "https://console.anthropic.com/settings/keys" },
  { id: "openai", name: "OpenAI", blurb: "GPT models.", keyUrl: "https://platform.openai.com/api-keys" },
  { id: "ollama", name: "Ollama (local)", blurb: "Free and private. Runs on your own computer." },
];

export function SettingsScreen({ nav }: { nav: Nav }) {
  const settings = useStore((s) => s.settings);
  const { setSettings, resetAll } = useStore.getState();
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    fetch("/api/status").then((r) => r.json()).then(setStatus).catch(() => setStatus(null));
  }, []);

  const p = settings.provider;
  return (
    <ScreenFrame nav={nav} title="Settings">
      <div style={{ maxWidth: 820, margin: "0 auto", display: "grid", gap: 18 }}>
        <section className="panel" style={{ padding: 22 }}>
          <h2 style={{ marginTop: 0 }}>Brain</h2>
          <p className="hint" style={{ marginTop: -6 }}>Which AI your avatars use by default. You can still give any avatar its own in the Avatar Maker.</p>
          <div className="options" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
            {PROVIDERS.map((x) => (
              <button key={x.id} className={`opt ${p === x.id ? "on" : ""}`} aria-pressed={p === x.id} onClick={() => setSettings({ provider: x.id })}>
                {x.name}
                {x.id !== "demo" && x.id !== "ollama" && (status?.env[x.id as "google"] || settings.keys[x.id as "google"]) ? " ✓" : ""}
                {x.id === "ollama" && status?.ollama.length ? " ✓" : ""}
              </button>
            ))}
          </div>
          <p className="hint">{PROVIDERS.find((x) => x.id === p)?.blurb}</p>

          {p !== "demo" && p !== "ollama" && (
            <>
              <label className="field">
                <span>API key</span>
                <input
                  className="input"
                  type="password"
                  autoComplete="off"
                  value={settings.keys[p]}
                  placeholder={status?.env[p] ? "Using the key from your .env file" : "Paste your key"}
                  onChange={(e) => setSettings({ keys: { ...settings.keys, [p]: e.target.value.trim() } })}
                />
              </label>
              <p className="hint" style={{ marginTop: -6 }}>
                Stored only in this browser and sent only to your own Plazai server on this computer.{" "}
                {PROVIDERS.find((x) => x.id === p)?.keyUrl && <a href={PROVIDERS.find((x) => x.id === p)!.keyUrl} target="_blank" rel="noreferrer">Get a key ↗</a>}
              </p>
            </>
          )}
          {p === "ollama" && (
            <p className="hint">
              {status?.ollama.length
                ? `Found ${status.ollama.length} model${status.ollama.length > 1 ? "s" : ""}: ${status.ollama.join(", ")}`
                : "Ollama isn't running. Install it from ollama.com, then run `ollama pull llama3.2`."}
            </p>
          )}
          {p !== "demo" && (
            <label className="field">
              <span>Model</span>
              {p === "ollama" && status?.ollama.length ? (
                <select className="select" value={settings.models.ollama} onChange={(e) => setSettings({ models: { ...settings.models, ollama: e.target.value } })}>
                  {[...new Set([settings.models.ollama, ...status.ollama])].map((m) => <option key={m}>{m}</option>)}
                </select>
              ) : (
                <input className="input" value={settings.models[p]} onChange={(e) => setSettings({ models: { ...settings.models, [p]: e.target.value } })} />
              )}
            </label>
          )}
        </section>

        <section className="panel" style={{ padding: 22 }}>
          <h2 style={{ marginTop: 0 }}>You</h2>
          <label className="field">
            <span>Your name (optional)</span>
            <input className="input" value={settings.ownerName} maxLength={40} onChange={(e) => setSettings({ ownerName: e.target.value })} placeholder="So your avatars know who they're helping" />
          </label>
          <button className={`opt ${settings.sound ? "on" : ""}`} style={{ padding: "10px 16px" }} aria-pressed={settings.sound} onClick={() => setSettings({ sound: !settings.sound })}>
            {settings.sound ? "🔊 Sounds on" : "🔈 Sounds off"}
          </button>
        </section>

        <section className="panel" style={{ padding: 22 }}>
          <h2 style={{ marginTop: 0 }}>Start over</h2>
          <p className="hint">Brings back Pip, Juno and Bo and clears everything else, including saved keys.</p>
          <button className="btn danger" onClick={() => confirm("Reset Plazai? This removes your avatars, teams, tasks and keys.") && resetAll()}>Reset Plazai</button>
        </section>
      </div>
    </ScreenFrame>
  );
}
