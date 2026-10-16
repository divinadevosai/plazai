import type { ReactNode } from "react";
import type { Nav } from "../App";

/** Shared screen frame: a "Menu" button back to the home menu, a title and optional actions. */
export function ScreenFrame({ nav, title, actions, children }: { nav: Nav; title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="screen">
      <div className="topbar">
        <MenuButton nav={nav} />
        <h1>{title}</h1>
        <div className="spacer" />
        {actions}
      </div>
      <div className="body">{children}</div>
    </div>
  );
}

export function MenuButton({ nav }: { nav: Nav }) {
  return (
    <button className="btn menu-btn" onClick={() => nav.go("home")}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m15 18-6-6 6-6" />
      </svg>
      Menu
    </button>
  );
}
