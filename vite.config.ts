import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { plazaiApi } from "./server/api.ts";

// Other sites can't put Plazai in a frame (no clickjacking), and pages don't leak where you came from.
const headers = {
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

// The AI calls run inside Vite's own server (dev and preview), so `npm run dev` is all you need
// and your API keys never leave your machine. strictPort keeps Plazai on one address, so the keys
// you save in the browser stay in one place.
export default defineConfig({
  plugins: [react(), plazaiApi()],
  server: { host: "127.0.0.1", port: 5173, strictPort: true, headers },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true, headers },
});
