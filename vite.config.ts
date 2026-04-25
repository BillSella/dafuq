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
        "src/AppAuthGate.tsx",
        "src/components/ui/NavToolButton.tsx",
        "src/components/ui/ToolButton.tsx",
        "src/components/ui/MenuDropdown.tsx",
        "src/components/ui/PillSelector.tsx",
        "src/components/ui/LabelFieldRow.tsx",
        "src/components/config/VerticalDivider.tsx",
        "src/components/config/TogglePillField.tsx",
        "src/components/config/WidgetVisibilityField.tsx",
        "src/components/config/OverlayPanel.tsx",
        "src/components/config/WidgetConfigOverlayShell.tsx",
        "src/components/config/DashboardSettingsOverlay.tsx",
        "src/components/config/ApiSettingsSection.tsx",
        "src/components/config/ApiConnectionFields.tsx",
        "src/components/config/BaseWidgetSettingsSection.tsx",
        "src/components/config/FormatDecimalsFields.tsx",
        "src/components/config/NumberGaugeSettingsForm.tsx",
        "src/components/config/LabelSettingsForm.tsx",
        "src/components/config/DonutSettingsForm.tsx",
        "src/components/config/BarSettingsForm.tsx",
        "src/components/config/SparklineSettingsForm.tsx",
        "src/components/config/TimeSeriesSettingsForm.tsx",
        "src/components/config/MapSettingsForm.tsx",
        "src/components/layout/LeftNavRail.tsx",
        "src/components/layout/AppTopbarTools.tsx",
        "src/components/layout/AppTopbarCenter.tsx",
        "src/components/layout/DashboardEditorPane.tsx",
        "src/components/layout/DashboardPlaceholderPane.tsx",
        "src/components/layout/WidgetCanvas.tsx",
        "src/components/auth/AuthLandingPage.tsx",
        "src/hooks/useDismissOnOutsideClick.ts",
        "src/timeWindow.ts",
        "src/authToken.ts",
        "src/dashboardPersistence.ts",
        "src/dashboardStore.ts",
        "src/layoutService.ts",
        "src/session/SessionContext.tsx",
        "src/dashboardServerSync.ts",
        "src/dashboard/useDashboardRollback.ts",
        "src/dashboard/useDashboardAutosave.ts"
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
