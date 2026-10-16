import { useStore } from "./store";

let ctx: AudioContext | null = null;

/** Tiny original chimes made with the Web Audio API (no sound files). */
const TUNES: Record<string, [number, number][]> = {
  tap: [[880, 0.05]],
  open: [[660, 0.06], [990, 0.09]],
  back: [[660, 0.06], [440, 0.09]],
  start: [[523, 0.08], [659, 0.08], [784, 0.12]],
  step: [[784, 0.06], [988, 0.1]],
  done: [[523, 0.08], [659, 0.08], [784, 0.08], [1047, 0.22]],
  error: [[330, 0.12], [262, 0.2]],
};

export function chime(name: keyof typeof TUNES) {
  if (!useStore.getState().settings.sound || typeof window === "undefined") return;
  try {
    ctx ??= new AudioContext();
    let t = ctx.currentTime + 0.01;
    for (const [freq, dur] of TUNES[name] ?? []) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.2);
      t += dur;
    }
  } catch {
    /* audio unavailable */
  }
}
