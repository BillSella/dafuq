import { For, type JSX } from "solid-js";
import { OverlayPanel } from "./OverlayPanel";

type DashboardSettingsOverlayProps = {
  panelRef?: JSX.HTMLAttributes<HTMLDivElement>["ref"];
  open: boolean;
  top: number;
  left: number;
  width: number;
  height: number;
  dashboardName: string;
  updateFrequencySeconds: number;
  frequencyOptions: readonly number[];
  deleteConfirmInput: string;
  onRename: (name: string) => void;
  onFrequencyIndexChange: (index: number) => void;
  onDeleteConfirmInputChange: (value: string) => void;
  onDelete: () => void;
};

/**
 * Dashboard-level settings overlay for rename, refresh cadence, and delete.
 *
 * State modification contract:
 * - Source of truth: all form values are controlled by parent props.
 * - Mutation paths: emits changes through `onRename`, `onFrequencyIndexChange`,
 *   `onDeleteConfirmInputChange`, and `onDelete`.
 * - Guard behavior: delete action remains disabled until confirmation text
 *   exactly matches the dashboard name.
 */
export function DashboardSettingsOverlay(props: DashboardSettingsOverlayProps): JSX.Element {
  const selectedFrequencyIndex = () =>
    Math.max(0, props.frequencyOptions.indexOf(props.updateFrequencySeconds as (typeof props.frequencyOptions)[number]));

  return (
    <OverlayPanel
      panelRef={props.panelRef}
      class="widget-config-overlay dashboard-settings-panel"
      open={props.open}
      slideDirection="bottom"
      top={props.top}
      left={props.left}
      width={props.width}
      height={props.height}
    >
      <label class="field">
        <span>Name</span>
        <input type="text" value={props.dashboardName} onInput={(event) => props.onRename(event.currentTarget.value)} />
      </label>
      <label class="field">
        <span>Update Frequency</span>
        <div class="update-frequency-value">{props.updateFrequencySeconds}s</div>
        <input
          type="range"
          min="0"
          max={String(props.frequencyOptions.length - 1)}
          step="1"
          value={String(selectedFrequencyIndex())}
          list="update-frequency-breakpoints"
          onInput={(event) => props.onFrequencyIndexChange(Number(event.currentTarget.value))}
        />
        <datalist id="update-frequency-breakpoints">
          <For each={props.frequencyOptions.map((_, index) => index)}>
            {(index) => <option value={String(index)} />}
          </For>
        </datalist>
      </label>
      <div class="field section-gap-top dashboard-delete-area">
        <input
          type="text"
          placeholder="Enter Dashboard Name to Delete"
          value={props.deleteConfirmInput}
          onInput={(event) => props.onDeleteConfirmInputChange(event.currentTarget.value)}
        />
        <button
          class="danger-delete-button"
          type="button"
          disabled={props.deleteConfirmInput !== props.dashboardName}
          onClick={props.onDelete}
        >
          Delete
        </button>
      </div>
    </OverlayPanel>
  );
}
