/* global process */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import child_process from "child_process";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

// Read package version and compute the current commit (short) if available
const pkg = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"),
);
let commit = process.env.GITHUB_SHA || process.env.APP_COMMIT || null;
if (!commit) {
  try {
    commit = child_process
      .execSync("git rev-parse --short HEAD")
      .toString()
      .trim();
  } catch {
    commit = null;
  }
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  // Build-time constants available to the client (version and commit)
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(commit),
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (
            id.includes("node_modules/react") ||
            id.includes("node_modules/react-dom")
          ) {
            return "react-vendor";
          }
          if (
            id.includes("node_modules/chart.js") ||
            id.includes("node_modules/react-chartjs-2")
          ) {
            return "chart-vendor";
          }
          if (id.includes("node_modules/papaparse")) {
            return "file-vendor";
          }
          if (id.includes("node_modules/@tauri-apps")) {
            return "tauri-vendor";
          }
          if (
            id.includes("node_modules/lucide-react") ||
            id.includes("node_modules/react-datepicker") ||
            id.includes("node_modules/react-markdown")
          ) {
            return "ui-vendor";
          }
        },
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
    css: true,
  },
}));
