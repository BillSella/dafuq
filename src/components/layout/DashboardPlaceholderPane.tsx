type DashboardPlaceholderPaneProps = {
  message: string;
};

/**
 * Presentational placeholder for non-dashboard routed panes.
 *
 * State modification contract:
 * - Pure render component; does not own or mutate state.
 * - Receives message content from parent routing/orchestration layer.
 */
export function DashboardPlaceholderPane(props: DashboardPlaceholderPaneProps) {
  return (
    <div class="dashboard-editor">
      <section class="editor-grid-area">
        <div class="grid-widget-shell">
          <p class="hint">{props.message}</p>
        </div>
      </section>
    </div>
  );
}
