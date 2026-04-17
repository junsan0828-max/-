import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // crossorigin 속성 제거 (same-origin 서버 배포 시 불필요)
    modulePreload: { polyfill: false },
  },
  server: {
    port: 5173,
    host: "0.0.0.0",
    proxy: {
      "/trpc": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
