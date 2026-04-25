import type { JSX } from "solid-js";

type ApiSettingsSectionProps = {
  children: JSX.Element;
};

/**
 * Presentational section wrapper for API-related widget settings.
 *
 * State modification contract:
 * - Pure layout wrapper with no owned mutable state.
 * - Receives all interactive controls through `children`.
 */
export function ApiSettingsSection(props: ApiSettingsSectionProps): JSX.Element {
  return (
    <section class="endpoint-block-shell field endpoint-field">
      <div class="api-settings-title">API Settings</div>
      {props.children}
    </section>
  );
}
