type DashboardPlaceholderPaneProps = {
  message: string;
};

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
