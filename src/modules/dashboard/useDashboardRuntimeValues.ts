import { createEffect, createSignal, onCleanup, type Accessor } from "solid-js";
import type { DashboardDoc, DashboardWidgetDoc } from "./dashboardStore";
import { resolveTimeRange, type TimeWindowState } from "./timeWindow";
import { fetchWidgetRuntimeValue, getWidgetGroupKey, type WidgetRuntimeStatus } from "./widgetDataService";
import type { AppModuleId } from "../moduleTypes";

type UseDashboardRuntimeValuesOptions = {
  activeNavTool: Accessor<AppModuleId>;
  activeDashboardDoc: Accessor<DashboardDoc | null>;
  timeWindow: Accessor<TimeWindowState>;
};

/**
 * Polls widget runtime values/status for the active dashboard and prunes stale IDs.
 */
export function useDashboardRuntimeValues(options: UseDashboardRuntimeValuesOptions) {
  const [runtimeWidgetValues, setRuntimeWidgetValues] = createSignal<Record<string, string>>({});
  const [runtimeWidgetStatus, setRuntimeWidgetStatus] = createSignal<Record<string, WidgetRuntimeStatus>>({});

  createEffect(() => {
    if (options.activeNavTool() !== "dashboards") return;
    const active = options.activeDashboardDoc();
    if (!active) return;
    void options.timeWindow();

    const widgetIds = new Set(active.widgets.map((widget) => widget.id));
    setRuntimeWidgetValues((previous) =>
      Object.fromEntries(Object.entries(previous).filter(([widgetId]) => widgetIds.has(widgetId)))
    );
    setRuntimeWidgetStatus((previous) =>
      Object.fromEntries(Object.entries(previous).filter(([widgetId]) => widgetIds.has(widgetId)))
    );

    const controller = new AbortController();
    let disposed = false;

    const runFetchCycle = async () => {
      if (disposed) return;
      const timeRange = resolveTimeRange(options.timeWindow());
      const groups = new Map<string, DashboardWidgetDoc[]>();
      active.widgets.forEach((widget) => {
        const key = getWidgetGroupKey(widget);
        const group = groups.get(key) ?? [];
        group.push(widget);
        groups.set(key, group);
      });

      const nextValues: Record<string, string> = {};
      const nextStatuses: Record<string, WidgetRuntimeStatus> = {};
      await Promise.all(
        Array.from(groups.values()).map(async (widgetsInGroup) => {
          const resolved = await Promise.all(
            widgetsInGroup.map(async (widget) => ({
              id: widget.id,
              result: await fetchWidgetRuntimeValue(widget, controller.signal, timeRange)
            }))
          );
          resolved.forEach((entry) => {
            nextValues[entry.id] = entry.result.value;
            nextStatuses[entry.id] = entry.result.status;
          });
        })
      );
      if (disposed) return;
      setRuntimeWidgetValues((previous) => ({ ...previous, ...nextValues }));
      setRuntimeWidgetStatus((previous) => ({ ...previous, ...nextStatuses }));
    };

    void runFetchCycle();
    const intervalSeconds = Math.max(1, active.updateFrequencySeconds ?? 60);
    const intervalId = window.setInterval(() => {
      void runFetchCycle();
    }, intervalSeconds * 1000);

    onCleanup(() => {
      disposed = true;
      controller.abort();
      window.clearInterval(intervalId);
    });
  });

  return {
    runtimeWidgetValues,
    runtimeWidgetStatus
  };
}
