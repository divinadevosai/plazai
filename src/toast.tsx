import { useEffect, useRef, useState } from "react";
import { create } from "zustand";

interface Toast {
  id: number;
  title: string;
  body?: string;
}

const useToasts = create<{ toasts: Toast[] }>(() => ({ toasts: [] }));
let seq = 0;
const LIFETIME = 4500;
const MAX = 3;

/** Show a small notice at the bottom of the screen. Call from anywhere. */
export function toast(title: string, body?: string) {
  useToasts.setState((s) => ({ toasts: [...s.toasts, { id: ++seq, title, body }].slice(-MAX) }));
}

const dismiss = (id: number) => useToasts.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));

/** Mount once. Newest toast sits in front; older ones tuck behind it. */
export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const [hovered, setHovered] = useState(false);
  return (
    <ol className="toaster" aria-live="polite" onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}>
      {toasts.map((t, i) => (
        <ToastItem key={t.id} toast={t} depth={toasts.length - 1 - i} expanded={hovered} />
      ))}
    </ol>
  );
}

function ToastItem({ toast: t, depth, expanded }: { toast: Toast; depth: number; expanded: boolean }) {
  const el = useRef<HTMLLIElement>(null);
  const drag = useRef<{ x: number; t: number } | null>(null);

  // Timer pauses while hovered and while the tab is hidden, so nothing is missed.
  useEffect(() => {
    let left = LIFETIME;
    let started = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      started = Date.now();
      timer = setTimeout(() => dismiss(t.id), left);
    };
    const pause = () => {
      clearTimeout(timer);
      left -= Date.now() - started;
    };
    if (!expanded && !document.hidden) run();
    const onVis = () => (document.hidden ? pause() : !expanded && run());
    document.addEventListener("visibilitychange", onVis);
    return () => {
      pause();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [t.id, expanded]);

  const y = expanded ? depth * -76 : depth * -10;
  const scale = expanded ? 1 : 1 - depth * 0.05;
  return (
    <li
      ref={el}
      className="toast"
      style={{ "--y": `${y}px`, "--s": scale, zIndex: 10 - depth } as React.CSSProperties}
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, t: Date.now() };
        e.currentTarget.setPointerCapture(e.pointerId);
        e.currentTarget.style.transition = "none";
      }}
      onPointerMove={(e) => {
        if (!drag.current || !el.current) return;
        el.current.style.transform = `translateX(${e.clientX - drag.current.x}px) translateY(${y}px) scale(${scale})`;
      }}
      onPointerUp={(e) => {
        if (!drag.current || !el.current) return;
        const dx = e.clientX - drag.current.x;
        const velocity = Math.abs(dx) / Math.max(1, Date.now() - drag.current.t);
        drag.current = null;
        el.current.style.transition = "";
        // A quick flick is enough; no need to drag all the way.
        if (Math.abs(dx) > 90 || velocity > 0.11) dismiss(t.id);
        else el.current.style.transform = "";
      }}
    >
      <b>{t.title}</b>
      {t.body && <span>{t.body}</span>}
    </li>
  );
}
