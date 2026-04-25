import { createEffect, onCleanup, type Accessor } from "solid-js";

type UseDismissOnOutsideClickOptions = {
  isOpen: Accessor<boolean>;
  containerRef: () => HTMLElement | undefined;
  triggerRef?: () => HTMLElement | undefined;
  onDismiss: () => void;
};

export function useDismissOnOutsideClick(options: UseDismissOnOutsideClickOptions) {
  createEffect(() => {
    if (!options.isOpen()) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        options.onDismiss();
      }
    };
    const onPointerDownOutside = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (options.containerRef()?.contains(target)) return;
      if (options.triggerRef?.()?.contains(target)) return;
      options.onDismiss();
    };
    window.addEventListener("keydown", onEscape);
    window.addEventListener("pointerdown", onPointerDownOutside);
    onCleanup(() => {
      window.removeEventListener("keydown", onEscape);
      window.removeEventListener("pointerdown", onPointerDownOutside);
    });
  });
}
