import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: "./frontend/e2e",
  use: { baseURL: "http://127.0.0.1:4173", browserName: "chromium" },
  webServer: {
    command: "node ../node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173 --strictPort",
    cwd: "frontend",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
    timeout: 30_000,
    env: {
      VITE_FIREBASE_API_KEY: " ",
      VITE_FIREBASE_AUTH_DOMAIN: " ",
      VITE_FIREBASE_PROJECT_ID: " ",
      VITE_FIREBASE_APP_ID: " ",
      VITE_API_URL: "/api/v1",
    },
  },
});
