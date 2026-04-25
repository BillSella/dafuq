import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { ApiSettingsSection } from "./ApiSettingsSection";

describe("ApiSettingsSection", () => {
  it("renders API settings title and child content", () => {
    const view = render(() => (
      <ApiSettingsSection>
        <div data-testid="api-content">Body</div>
      </ApiSettingsSection>
    ));

    expect(screen.getByText("API Settings")).toBeInTheDocument();
    expect(screen.getByTestId("api-content")).toBeInTheDocument();
    expect(view.container.querySelector(".endpoint-block-shell.endpoint-field")).toBeInTheDocument();
  });
});

