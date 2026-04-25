import { cleanup, fireEvent, render } from "@solidjs/testing-library";
import { createSignal, type JSX } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDismissOnOutsideClick } from "./useDismissOnOutsideClick";

afterEach(() => {
  cleanup();
});

function Harness(props: { open: boolean; onDismiss: () => void }): JSX.Element {
  let containerRef: HTMLDivElement | undefined;
  let triggerRef: HTMLButtonElement | undefined;
  const isOpen = () => props.open;

  useDismissOnOutsideClick({
    isOpen,
    containerRef: () => containerRef,
    triggerRef: () => triggerRef,
    onDismiss: props.onDismiss
  });

  return (
    <div>
      <button ref={triggerRef} type="button" data-testid="trigger">
        trigger
      </button>
      <div ref={containerRef} data-testid="container">
        content
      </div>
      <div data-testid="outside">outside</div>
    </div>
  );
}

describe("useDismissOnOutsideClick", () => {
  it("dismisses on Escape and outside pointerdown when open", async () => {
    const onDismiss = vi.fn();
    const view = render(() => <Harness open onDismiss={onDismiss} />);

    await fireEvent.keyDown(window, { key: "Escape" });
    await fireEvent.pointerDown(view.getByTestId("outside"));
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });

  it("does not dismiss when clicking inside container or trigger", async () => {
    const onDismiss = vi.fn();
    const view = render(() => <Harness open onDismiss={onDismiss} />);

    await fireEvent.pointerDown(view.getByTestId("container"));
    await fireEvent.pointerDown(view.getByTestId("trigger"));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("does not dismiss when closed", async () => {
    const onDismiss = vi.fn();
    const [open] = createSignal(false);
    const view = render(() => <Harness open={open()} onDismiss={onDismiss} />);

    await fireEvent.keyDown(window, { key: "Escape" });
    await fireEvent.pointerDown(view.getByTestId("outside"));
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

