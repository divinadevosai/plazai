import type { Settings } from "./types";

/**
 * Plazai follows your real clock. Add ?time=23:30 to the URL to preview another time of day
 * (the clock still ticks from there), handy for seeing night time without waiting for it.
 */
const offset = (() => {
  if (typeof location === "undefined") return 0;
  const m = /^(\d{1,2}):(\d{2})$/.exec(new URLSearchParams(location.search).get("time") ?? "");
  if (!m) return 0;
  const want = new Date();
  want.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return want.getTime() - Date.now();
})();

export const clockNow = () => Date.now() + offset;
export const isPreviewTime = offset !== 0;

/** Minutes since local midnight. */
export const minuteOfDay = (ms = clockNow()) => {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
};

const parseHM = (hm: string) => {
  const [h, m] = hm.split(":").map(Number);
  return ((h ?? 0) % 24) * 60 + (m ?? 0);
};

/** True when minute m falls in [from, to), wrapping past midnight. */
const within = (m: number, from: number, to: number) => (from <= to ? m >= from && m < to : m >= from || m < to);

export type SleepPhase = "awake" | "goingHome" | "asleep";
export const WIND_DOWN_MIN = 30;

/** Where the avatars are in their day: awake, heading home before bed, or asleep. */
export function sleepPhase(sleep: Settings["sleep"], ms = clockNow()): SleepPhase {
  if (!sleep.enabled) return "awake";
  const m = minuteOfDay(ms);
  const bed = parseHM(sleep.bedtime);
  const wake = parseHM(sleep.wake);
  if (within(m, bed, wake)) return "asleep";
  if (within(m, (bed - WIND_DOWN_MIN + 1440) % 1440, bed)) return "goingHome";
  return "awake";
}

export type DayPhase = SleepPhase | "lunch";

/** The whole daily routine: bedtime first, then the lunch break (only while they're awake). */
export function dayPhase(settings: Pick<Settings, "sleep" | "lunch">, ms = clockNow()): DayPhase {
  const p = sleepPhase(settings.sleep, ms);
  if (p !== "awake" || !settings.lunch.enabled) return p;
  return within(minuteOfDay(ms), parseHM(settings.lunch.start), parseHM(settings.lunch.end)) ? "lunch" : "awake";
}

/** Off duty: asleep, or out for lunch. New work waits unless it's urgent. */
export type OffDuty = "asleep" | "lunch" | null;
export const offDutyOf = (p: DayPhase): OffDuty => (p === "asleep" || p === "lunch" ? p : null);

/** 1 in full daylight, 0 at night, easing through dawn (6–8) and dusk (18–20:30). */
export function daylight(ms = clockNow()) {
  const h = minuteOfDay(ms) / 60;
  const smooth = (x: number) => x * x * (3 - 2 * x);
  if (h < 6 || h >= 20.5) return 0;
  if (h < 8) return smooth((h - 6) / 2);
  if (h < 18) return 1;
  return smooth(1 - (h - 18) / 2.5);
}
