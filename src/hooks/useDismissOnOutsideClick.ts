import { createEffect, onCleanup, type Accessor } from "solid-js";

type UseDismissOnOutsideClickOptions = {
  isOpen: Accessor<boolean>;
  containerRef: () => HTMLElement | undefined;
  triggerRef?: () => HTMLElement | undefined;
  onDismiss: () => void;
};

/**
 * Registers escape/outside-pointer dismissal while an overlay is open.
 *
 * State modification contract:
 * - Source of truth for open state is the caller-provided accessor.
 * - Mutation path is `onDismiss`, invoked on eligible dismiss interactions.
 * - Guard rules:
 *   - no listeners are attached while closed
 *   - interactions inside container/trigger do not dismiss
 */
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
