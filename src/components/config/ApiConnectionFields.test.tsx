import { cleanup, fireEvent, render, screen, within } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiConnectionFields } from "./ApiConnectionFields";

afterEach(() => {
  cleanup();
});

describe("ApiConnectionFields", () => {
  it("renders default placeholders without datalist when options are empty", () => {
    const view = render(() => (
      <ApiConnectionFields
        endpointUrl=""
        updateGroup=""
        onEndpointUrlChange={vi.fn()}
        onUpdateGroupChange={vi.fn()}
      />
    ));

    expect(screen.getByPlaceholderText("https://api.foo.com/...")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Optional Data Synchronization Group Name")).toBeInTheDocument();
    expect(view.container.querySelector("datalist")).not.toBeInTheDocument();
  });

  it("binds custom list id/options and emits input callbacks", async () => {
    const onEndpointUrlChange = vi.fn();
    const onUpdateGroupChange = vi.fn();
    const view = render(() => (
      <ApiConnectionFields
        endpointUrl="https://api.example.com/metrics"
        endpointPlaceholder="Endpoint"
        updateGroup="plant-a"
        updateGroupPlaceholder="Group"
        updateGroupOptions={["plant-a", "plant-b"]}
        updateGroupListId="shared-group-options"
        onEndpointUrlChange={onEndpointUrlChange}
        onUpdateGroupChange={onUpdateGroupChange}
      />
    ));
    const scoped = within(view.container);
    const inputs = scoped.getAllByRole("combobox");

    expect(view.container.querySelector("datalist#shared-group-options")).toBeInTheDocument();
    expect(view.container.querySelectorAll("datalist#shared-group-options option")).toHaveLength(2);
    expect(inputs[0]).toHaveAttribute("list", "shared-group-options");
    expect(inputs[1]).toHaveAttribute("list", "shared-group-options");

    await fireEvent.input(inputs[0]!, { target: { value: "https://api.example.com/new" } });
    await fireEvent.input(inputs[1]!, { target: { value: "plant-b" } });
    expect(onEndpointUrlChange).toHaveBeenCalledWith("https://api.example.com/new");
    expect(onUpdateGroupChange).toHaveBeenCalledWith("plant-b");
  });
});

