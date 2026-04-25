import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { DashboardPlaceholderPane } from "./DashboardPlaceholderPane";

describe("DashboardPlaceholderPane", () => {
  it("renders provided placeholder message", () => {
    render(() => <DashboardPlaceholderPane message="Help view placeholder." />);
    expect(screen.getByText("Help view placeholder.")).toBeInTheDocument();
  });
});

