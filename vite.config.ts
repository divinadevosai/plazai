import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { plazaiApi } from "./server/api";

// The AI calls run inside Vite's own server (dev and preview), so `npm run dev` is all you need
// and your API keys never leave your machine.
export default defineConfig({
  plugins: [react(), plazaiApi()],
  server: { host: "127.0.0.1", port: 5173 },
  preview: { host: "127.0.0.1", port: 4173 },
});
