import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  server: {
    proxy: {
      // Dev: Vite (5173) → Go app (e.g. 8080) for /api and OAuth.
      "/api": { target: "http://127.0.0.1:8080", changeOrigin: true }
    }
  }
});
