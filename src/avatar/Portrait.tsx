import { useMemo } from "react";
import type { Look } from "../types";
import { portraitURL } from "./face";

/** Flat head-and-shoulders picture of an avatar. */
export function Portrait({ look, size = 128, className, alt = "" }: { look: Look; size?: number; className?: string; alt?: string }) {
  const src = useMemo(() => portraitURL(look, Math.min(512, size * 2)), [look, size]);
  return <img src={src} width={size} height={size} className={className} alt={alt} draggable={false} />;
}
