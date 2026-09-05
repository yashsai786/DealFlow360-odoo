import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { viteApiBridgePlugin } from "./src/server/viteApiBridgePlugin";

export default defineConfig({
  plugins: [react(), tailwindcss(), viteApiBridgePlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
});
