import type { Look } from "../types";

export const SKINS = ["#fde3cf", "#f6d3b3", "#efc39c", "#e8b48f", "#cf9468", "#a46a46", "#7d4a2c", "#5a3420"];
export const HAIR_COLORS = ["#1d1714", "#3b2a20", "#6b4428", "#b5562c", "#d9a441", "#efd9a0", "#9a9a9a", "#f2f2f2", "#5b7be0", "#e06fa8"];
export const CLOTHES = ["#e84d4d", "#f2913d", "#f5d04a", "#7bd389", "#3fae6a", "#4fb3e8", "#3f6fd8", "#8a6ce0", "#f28bb6", "#ffffff", "#5a5f6e", "#2c2f38"];
export const PANTS = ["#3d4a66", "#2f3b55", "#46413b", "#6a5a48", "#2c2f38", "#7c8597"];

export const HAIR_STYLES = ["Bald", "Buzz", "Side part", "Spiky", "Bob", "Long", "Puffy", "Bun"];
export const EYES = ["Dots", "Happy", "Lashes", "Sleepy", "Sparkly"];
export const BROWS = ["Flat", "Arched", "Bold", "None"];
export const NOSES = ["Dot", "Button", "Line"];
export const MOUTHS = ["Smile", "Grin", "Small", "Oh", "Smirk"];

const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]!;
const range = (lo: number, hi: number) => Math.round((lo + Math.random() * (hi - lo)) * 100) / 100;

export function randomLook(): Look {
  return {
    skin: pick(SKINS),
    hair: Math.floor(Math.random() * HAIR_STYLES.length),
    hairColor: pick(HAIR_COLORS.slice(0, 7)),
    eyes: Math.floor(Math.random() * EYES.length),
    brows: Math.floor(Math.random() * BROWS.length),
    nose: Math.floor(Math.random() * NOSES.length),
    mouth: Math.floor(Math.random() * MOUTHS.length),
    shirt: pick(CLOTHES),
    pants: pick(PANTS),
    height: range(0.9, 1.1),
    build: range(0.9, 1.12),
    glasses: Math.random() < 0.25,
    blush: Math.random() < 0.6,
  };
}

/** Slightly darker version of a colour, for outlines and shading. */
export function shade(hex: string, f = 0.78) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c((n >> 16) & 255)}, ${c((n >> 8) & 255)}, ${c(n & 255)})`;
}
