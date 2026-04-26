import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import {
  fromDateTimeLocalValue,
  loadTimeWindowFromStorage,
  resolveTimeRange,
  saveTimeWindowToStorage,
  toDateTimeLocalValue,
  type TimeWindowState
} from "./timeWindow";

function formatLocalClock(): string {
  return new Date().toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  });
}

function formatTopbarRangePoint(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

/**
 * Owns topbar time-window state, persistence, and derived clock labels.
 */
export function useDashboardTopbarTimeWindow() {
  const [timeWindow, setTimeWindow] = createSignal<TimeWindowState>(loadTimeWindowFromStorage());
  const [timeWindowMenuOpen, setTimeWindowMenuOpen] = createSignal(false);
  const [timeWindowMenuView, setTimeWindowMenuView] = createSignal<"list" | "custom">("list");
  const [customRangeFrom, setCustomRangeFrom] = createSignal("");
  const [customRangeTo, setCustomRangeTo] = createSignal("");
  const [currentClock, setCurrentClock] = createSignal(formatLocalClock());

  const currentClockIso = createMemo(() => {
    currentClock();
    return new Date().toISOString();
  });

  const topbarCustomTimeSpan = createMemo(() => {
    const tw = timeWindow();
    if (tw.kind !== "absolute") return "";
    const { fromMs, toMs } = resolveTimeRange(tw);
    return `${formatTopbarRangePoint(fromMs)} - ${formatTopbarRangePoint(toMs)}`;
  });

  const applyTimeWindow = (next: TimeWindowState) => {
    setTimeWindow(next);
    saveTimeWindowToStorage(next);
    setTimeWindowMenuOpen(false);
    setTimeWindowMenuView("list");
  };

  const openTimeWindowCustom = () => {
    const tw = timeWindow();
    if (tw.kind === "absolute") {
      setCustomRangeFrom(toDateTimeLocalValue(tw.fromMs));
      setCustomRangeTo(toDateTimeLocalValue(tw.toMs));
    } else {
      const r = resolveTimeRange(tw);
      setCustomRangeFrom(toDateTimeLocalValue(r.fromMs));
      setCustomRangeTo(toDateTimeLocalValue(r.toMs));
    }
    setTimeWindowMenuView("custom");
  };

  const applyTimeWindowCustom = () => {
    let a = fromDateTimeLocalValue(customRangeFrom());
    let b = fromDateTimeLocalValue(customRangeTo());
    if (a == null || b == null) return;
    if (a === b) b = a + 60_000;
    applyTimeWindow({ kind: "absolute", fromMs: Math.min(a, b), toMs: Math.max(a, b) });
  };

  createEffect(() => {
    setCurrentClock(formatLocalClock());
    const t = window.setInterval(() => setCurrentClock(formatLocalClock()), 1000);
    onCleanup(() => clearInterval(t));
  });

  return {
    timeWindow,
    timeWindowMenuOpen,
    timeWindowMenuView,
    customRangeFrom,
    customRangeTo,
    currentClock,
    currentClockIso,
    topbarCustomTimeSpan,
    setTimeWindowMenuOpen,
    setTimeWindowMenuView,
    setCustomRangeFrom,
    setCustomRangeTo,
    applyTimeWindow,
    openTimeWindowCustom,
    applyTimeWindowCustom
  };
}
