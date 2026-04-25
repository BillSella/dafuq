import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { MenuDropdown } from "./MenuDropdown";

describe("MenuDropdown", () => {
  it("applies open class when open is true", () => {
    const view = render(() => (
      <MenuDropdown class="menu-shell" open role="menu" aria-label="Demo menu">
        <button type="button">Item</button>
      </MenuDropdown>
    ));

    const menu = view.container.querySelector(".menu-shell");
    expect(menu).toBeInTheDocument();
    expect(menu?.classList.contains("open")).toBe(true);
    expect(menu).toHaveAttribute("role", "menu");
    expect(menu).toHaveAttribute("aria-label", "Demo menu");
  });

  it("does not apply open class when open is false", () => {
    const view = render(() => (
      <MenuDropdown class="menu-shell" open={false}>
        <div>Closed</div>
      </MenuDropdown>
    ));

    const menu = view.container.querySelector(".menu-shell");
    expect(menu?.classList.contains("open")).toBe(false);
  });
});

