import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  server: {
    proxy: {
      // Dev: Vite (5173) -> Go app for /api and OAuth.
      // Override with VITE_API_PROXY_TARGET (e.g. http://127.0.0.1:18080).
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:8080",
        changeOrigin: true
      }
    }
  }
});
