import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:5170",
      "/media": "http://127.0.0.1:5170",
      "/media-path": "http://127.0.0.1:5170",
      "/vod-media": "http://127.0.0.1:5170",
      "/download-path": "http://127.0.0.1:5170",
      "/open-folder-path": "http://127.0.0.1:5170",
      "/delete-path": "http://127.0.0.1:5170",
      "/capture-area/save": "http://127.0.0.1:5170",
      "/react": "http://127.0.0.1:5170"
    }
  },
  build: {
    outDir: "dist"
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.js",
    include: ["src/**/*.{test,spec}.{js,jsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "cobertura"],
      include: [
        "src/api/captureArea.js",
        "src/api/clips.js",
        "src/api/clipsViewer.js",
        "src/api/overlayTool.js",
        "src/hooks/useVodViewerData.js"
      ],
      thresholds: {
        statements: 67,
        branches: 60,
        functions: 67,
        lines: 67
      }
    }
  }
});
