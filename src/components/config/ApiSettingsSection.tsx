import type { JSX } from "solid-js";

type ApiSettingsSectionProps = {
  children: JSX.Element;
};

export function ApiSettingsSection(props: ApiSettingsSectionProps): JSX.Element {
  return (
    <section class="endpoint-block-shell field endpoint-field">
      <div class="api-settings-title">API Settings</div>
      {props.children}
    </section>
  );
}
