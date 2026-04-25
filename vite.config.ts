import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "./coverage",
      include: [
        "src/components/ui/NavToolButton.tsx",
        "src/components/layout/LeftNavRail.tsx",
        "src/components/layout/AppTopbarTools.tsx",
        "src/components/layout/AppTopbarCenter.tsx"
      ],
      exclude: [
        "src/main.tsx",
        "src/vite-env.d.ts",
        "**/*.d.ts"
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 80,
        statements: 90
      }
    }
  },
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
