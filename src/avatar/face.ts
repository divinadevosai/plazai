import type { Look } from "../types";
import { shade } from "./parts";

const INK = "#2a2522";

/**
 * Draws the face features (eyes, brows, nose, mouth, blush, glasses) centred on (cx, cy).
 * R is the head radius in pixels; every feature is placed in units of R, so the same drawing
 * works for a flat portrait and for the texture wrapped round the 3D head.
 */
export function drawFeatures(ctx: CanvasRenderingContext2D, look: Look, cx: number, cy: number, R: number) {
  const ex = 0.32 * R, ey = cy - 0.02 * R, lw = Math.max(2, 0.055 * R);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = lw;

  if (look.blush) {
    ctx.fillStyle = "rgba(240, 110, 120, 0.32)";
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + s * 0.45 * R, cy + 0.22 * R, 0.13 * R, 0.08 * R, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = INK;
  }

  for (const s of [-1, 1]) {
    const x = cx + s * ex;
    switch (look.eyes) {
      case 1: // happy arcs
        ctx.beginPath();
        ctx.arc(x, ey + 0.05 * R, 0.1 * R, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
        break;
      case 2: // lashes
        ctx.beginPath();
        ctx.ellipse(x, ey, 0.07 * R, 0.1 * R, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + s * 0.06 * R, ey - 0.08 * R);
        ctx.lineTo(x + s * 0.13 * R, ey - 0.14 * R);
        ctx.stroke();
        break;
      case 3: // sleepy
        ctx.beginPath();
        ctx.moveTo(x - 0.09 * R, ey + 0.01 * R);
        ctx.quadraticCurveTo(x, ey + 0.08 * R, x + 0.09 * R, ey + 0.01 * R);
        ctx.stroke();
        break;
      case 4: // sparkly
        ctx.beginPath();
        ctx.ellipse(x, ey, 0.085 * R, 0.12 * R, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(x - 0.025 * R, ey - 0.04 * R, 0.03 * R, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = INK;
        break;
      default: // dots
        ctx.beginPath();
        ctx.ellipse(x, ey, 0.06 * R, 0.085 * R, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // brows
    const by = ey - 0.2 * R;
    ctx.lineWidth = look.brows === 2 ? lw * 1.8 : lw;
    if (look.brows === 0 || look.brows === 2) {
      ctx.beginPath();
      ctx.moveTo(x - 0.1 * R, by);
      ctx.lineTo(x + 0.1 * R, by - s * 0.0 * R);
      ctx.stroke();
    } else if (look.brows === 1) {
      ctx.beginPath();
      ctx.arc(x, by + 0.08 * R, 0.12 * R, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
    }
    ctx.lineWidth = lw;
  }

  // nose
  const ny = cy + 0.14 * R;
  ctx.strokeStyle = shade(look.skin, 0.62);
  ctx.fillStyle = shade(look.skin, 0.7);
  if (look.nose === 0) {
    ctx.beginPath();
    ctx.ellipse(cx, ny, 0.04 * R, 0.03 * R, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (look.nose === 1) {
    ctx.beginPath();
    ctx.arc(cx, ny, 0.07 * R, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(cx + 0.01 * R, ny - 0.1 * R);
    ctx.lineTo(cx - 0.03 * R, ny + 0.03 * R);
    ctx.lineTo(cx + 0.03 * R, ny + 0.03 * R);
    ctx.stroke();
  }

  // mouth
  const my = cy + 0.34 * R;
  ctx.strokeStyle = INK;
  ctx.fillStyle = "#7a2f35";
  ctx.lineWidth = lw;
  switch (look.mouth) {
    case 1: // grin
      ctx.beginPath();
      ctx.moveTo(cx - 0.17 * R, my - 0.03 * R);
      ctx.quadraticCurveTo(cx, my + 0.22 * R, cx + 0.17 * R, my - 0.03 * R);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 2: // small
      ctx.beginPath();
      ctx.moveTo(cx - 0.06 * R, my);
      ctx.quadraticCurveTo(cx, my + 0.05 * R, cx + 0.06 * R, my);
      ctx.stroke();
      break;
    case 3: // oh
      ctx.beginPath();
      ctx.ellipse(cx, my + 0.02 * R, 0.06 * R, 0.08 * R, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    case 4: // smirk
      ctx.beginPath();
      ctx.moveTo(cx - 0.12 * R, my + 0.03 * R);
      ctx.quadraticCurveTo(cx + 0.02 * R, my + 0.07 * R, cx + 0.14 * R, my - 0.05 * R);
      ctx.stroke();
      break;
    default: // smile
      ctx.beginPath();
      ctx.arc(cx, my - 0.1 * R, 0.16 * R, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
  }

  if (look.glasses) {
    ctx.strokeStyle = "#2b2f3a";
    ctx.lineWidth = lw * 0.9;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + s * ex, ey, 0.15 * R, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - ex + 0.15 * R, ey);
    ctx.lineTo(cx + ex - 0.15 * R, ey);
    ctx.stroke();
  }
}

/** Flat hair shapes for portraits: "back" is drawn behind the head, "front" over it. */
function drawHair2D(ctx: CanvasRenderingContext2D, look: Look, cx: number, cy: number, R: number, layer: "back" | "front") {
  ctx.fillStyle = look.hairColor;
  const h = look.hair;
  if (layer === "back") {
    if (h === 4) roundRect(ctx, cx - 1.08 * R, cy - 0.9 * R, 2.16 * R, 1.55 * R, 0.5 * R);
    if (h === 5) roundRect(ctx, cx - 1.1 * R, cy - 0.9 * R, 2.2 * R, 2.05 * R, 0.5 * R);
    if (h === 6) {
      ctx.beginPath();
      ctx.arc(cx, cy - 0.25 * R, 1.25 * R, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  if (h === 0) return;
  // cap over the top of the head
  const depth = h === 1 ? 0.55 : h === 4 || h === 5 ? 0.35 : 0.45;
  ctx.beginPath();
  ctx.arc(cx, cy, 1.03 * R, Math.PI * (1 + depth * 0.18), Math.PI * (2 - depth * 0.18));
  ctx.quadraticCurveTo(cx, cy - (0.2 + depth * 0.3) * R, cx - 1.0 * R, cy - 0.2 * R);
  ctx.fill();
  if (h === 2) {
    ctx.beginPath();
    ctx.ellipse(cx - 0.35 * R, cy - 0.62 * R, 0.6 * R, 0.25 * R, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (h === 3) {
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      const x = cx + i * 0.26 * R;
      ctx.moveTo(x - 0.16 * R, cy - 0.8 * R);
      ctx.lineTo(x + i * 0.04 * R, cy - (1.28 - Math.abs(i) * 0.06) * R);
      ctx.lineTo(x + 0.16 * R, cy - 0.8 * R);
      ctx.fill();
    }
  }
  if (h === 7) {
    ctx.beginPath();
    ctx.arc(cx, cy - 1.12 * R, 0.3 * R, 0, Math.PI * 2);
    ctx.fill();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

const portraitCache = new Map<string, string>();

/** A head-and-shoulders portrait as a data URL (cached per look). */
export function portraitURL(look: Look, size = 256): string {
  const key = `${size}:${JSON.stringify(look)}`;
  const hit = portraitCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const R = size * 0.3 * (0.95 + (look.build - 1) * 0.15);
  const cx = size / 2, cy = size * 0.44;

  drawHair2D(ctx, look, cx, cy, R, "back");
  // shoulders
  ctx.fillStyle = look.shirt;
  ctx.beginPath();
  ctx.ellipse(cx, size * 1.02, size * 0.36 * look.build, size * 0.22, 0, Math.PI, 0);
  ctx.fill();
  // ears + head
  ctx.fillStyle = look.skin;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(cx + s * R * 0.98, cy + 0.08 * R, 0.17 * R, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(cx, cy, R, R * 1.03, 0, 0, Math.PI * 2);
  ctx.fill();
  drawFeatures(ctx, look, cx, cy, R);
  drawHair2D(ctx, look, cx, cy, R, "front");

  const url = c.toDataURL("image/png");
  if (portraitCache.size > 200) portraitCache.clear();
  portraitCache.set(key, url);
  return url;
}

/**
 * Equirectangular face texture for a sphere (2:1). Three.js puts the sphere's +Z (front)
 * at u = 0.25, so the face is centred there; elsewhere the canvas stays transparent.
 */
export function faceTexture(look: Look): HTMLCanvasElement {
  const W = 1024, H = 512;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const pxPerRadian = H / Math.PI;
  drawFeatures(ctx, look, W * 0.25, H * 0.5, pxPerRadian);
  return c;
}
