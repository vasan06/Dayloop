import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const frontendDir = fileURLToPath(new URL(".", import.meta.url));
const apiPort = process.env.DAYLOOP_PORT ?? "8000";
const apiHost = process.env.DAYLOOP_HOST ?? "127.0.0.1";
const proxyHost = apiHost === "0.0.0.0" ? "127.0.0.1" : apiHost;

export default defineConfig({
  root: frontendDir,
  envDir: frontendDir,
  envPrefix: "VITE_",
  plugins: [react(), {
    name: "dayloop-offline-shell",
    apply: "build",
    enforce: "post",
    generateBundle(_, bundle) {
      const assets = [...Object.keys(bundle).filter((name) => !name.endsWith(".map")),
        "dayloop-mark.svg", "dayloop-mark.png", "manifest.webmanifest"].sort().map((name) => "/" + name);
      const html = bundle["index.html"];
      const hash = createHash("sha256").update(JSON.stringify(assets));
      if (html?.type === "asset") hash.update(html.source);
      for (const file of ["dayloop-mark.svg", "dayloop-mark.png", "manifest.webmanifest"]) {
        hash.update(readFileSync(new URL("./public/" + file, import.meta.url)));
      }
      const name = "dayloop-shell-" + hash.digest("hex").slice(0, 16);
      const worker = readFileSync(new URL("./sw.js", import.meta.url), "utf8");
      this.emitFile({ type: "asset", fileName: "sw.js",
        source: worker.replace("__DAYLOOP_SHELL__", JSON.stringify({ name, assets })) });
    },
  }],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    // The frontend calls /api/v1; forward it to FastAPI rather than Vite's SPA fallback.
    proxy: {
      "/api": {
        target: `http://${proxyHost}:${apiPort}`,
        changeOrigin: true,
      },
    },
  },
});
