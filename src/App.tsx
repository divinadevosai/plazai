import { lazy, Suspense, useState } from "react";
import { chime } from "./sound";
import { Board } from "./screens/Board";
import { Home } from "./screens/Home";
import { SettingsScreen } from "./screens/Settings";
import { Tasks } from "./screens/Tasks";

// The 3D screens (and three.js) load on first use, so the menu opens instantly.
const Plaza = lazy(() => import("./screens/Plaza").then((m) => ({ default: m.Plaza })));
const Maker = lazy(() => import("./screens/Maker").then((m) => ({ default: m.Maker })));
import { Teams } from "./screens/Teams";

export type Screen = "home" | "plaza" | "maker" | "tasks" | "board" | "teams" | "settings";
export interface Nav {
  go: (s: Screen, opts?: { agentId?: string }) => void;
}

export function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [agentId, setAgentId] = useState<string | undefined>();
  const nav: Nav = {
    go: (s, opts) => {
      chime(s === "home" ? "back" : "open");
      setAgentId(opts?.agentId);
      setScreen(s);
    },
  };
  switch (screen) {
    case "plaza":
      return <Suspense fallback={<Loading />}><Plaza nav={nav} /></Suspense>;
    case "maker":
      return <Suspense fallback={<Loading />}><Maker nav={nav} initialId={agentId} /></Suspense>;
    case "tasks":
      return <Tasks nav={nav} initialAgentId={agentId} />;
    case "board":
      return <Board nav={nav} />;
    case "teams":
      return <Teams nav={nav} />;
    case "settings":
      return <SettingsScreen nav={nav} />;
    default:
      return <Home nav={nav} />;
  }
}

function Loading() {
  return <div className="screen" style={{ display: "grid", placeItems: "center", color: "var(--mute)", fontWeight: 800 }}>Loading…</div>;
}
