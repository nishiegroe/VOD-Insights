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
  }
});
