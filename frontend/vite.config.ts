import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const frontendDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: frontendDir,
  envDir: frontendDir,
  envPrefix: "VITE_",
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    // Keep the HMR socket on the same origin/port as the page in local development.
    hmr: {
      host: "localhost",
      protocol: "ws",
      clientPort: 5173,
    },
    // The frontend calls /api/v1; forward it to FastAPI rather than Vite's SPA fallback.
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
