import { lazy, Suspense, useEffect, useState } from "react";
import { tickScheduler } from "./engine/run";
import { Toaster } from "./toast";
import { CalendarScreen } from "./screens/Calendar";
import { chime } from "./sound";
import { Board } from "./screens/Board";
import { Home } from "./screens/Home";
import { SettingsScreen } from "./screens/Settings";
import { Tasks } from "./screens/Tasks";

// The 3D screens (and three.js) load on first use, so the menu opens instantly.
const Plaza = lazy(() => import("./screens/Plaza").then((m) => ({ default: m.Plaza })));
const Maker = lazy(() => import("./screens/Maker").then((m) => ({ default: m.Maker })));
import { Teams } from "./screens/Teams";
import { useStore } from "./store";

export type Screen = "home" | "plaza" | "maker" | "tasks" | "board" | "teams" | "settings" | "calendar";
export interface Nav {
  go: (s: Screen, opts?: { agentId?: string; buildingId?: string; tour?: boolean }) => void;
}

export function App() {
  // First visit: straight into the world for the welcome tour.
  const [screen, setScreen] = useState<Screen>(() => (useStore.getState().introSeen ? "home" : "plaza"));
  const [tour, setTour] = useState(false);
  const [agentId, setAgentId] = useState<string | undefined>();
  const [buildingId, setBuildingId] = useState<string | undefined>();
  // Reminders and scheduled tasks fire while Plazai is open. With several tabs open, only one runs
  // the scheduler, so nothing is started (and paid for) twice.
  useEffect(() => {
    let t: ReturnType<typeof setInterval> | undefined;
    const ac = new AbortController();
    const start = () => {
      tickScheduler();
      t = setInterval(() => tickScheduler(), 15_000);
    };
    if (navigator.locks) {
      navigator.locks
        .request("plazai-scheduler", { signal: ac.signal }, () => {
          start();
          return new Promise<void>((resolve) => ac.signal.addEventListener("abort", () => resolve()));
        })
        .catch(() => {});
    } else start();
    return () => {
      ac.abort();
      clearInterval(t);
    };
  }, []);
  const nav: Nav = {
    go: (s, opts) => {
      chime(s === "home" ? "back" : "open");
      setAgentId(opts?.agentId);
      setBuildingId(opts?.buildingId);
      setTour(!!opts?.tour);
      setScreen(s);
    },
  };
  return (
    <>
      {render()}
      <Toaster />
    </>
  );

  function render() {
  switch (screen) {
    case "plaza":
      return <Suspense fallback={<Loading />}><Plaza key={tour ? "tour" : "plaza"} nav={nav} tour={tour} /></Suspense>;
    case "maker":
      return <Suspense fallback={<Loading />}><Maker nav={nav} initialId={agentId} /></Suspense>;
    case "tasks":
      return <Tasks nav={nav} initialAgentId={agentId} initialBuildingId={buildingId} />;
    case "board":
      return <Board nav={nav} />;
    case "teams":
      return <Teams nav={nav} />;
    case "settings":
      return <SettingsScreen nav={nav} />;
    case "calendar":
      return <CalendarScreen nav={nav} />;
    default:
      return <Home nav={nav} />;
  }
  }
}

function Loading() {
  return <div className="screen" style={{ display: "grid", placeItems: "center", color: "var(--mute)", fontWeight: 800 }}>Loading…</div>;
}
