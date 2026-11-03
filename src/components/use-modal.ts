"use client";
import { useEffect, useRef } from "react";
/** Keep keyboard navigation in the current dialog and restore the trigger. */
export function useModal(
  active: boolean,
  close: () => void,
  identity?: string,
) {
  const onClose = useRef(close);
  onClose.current = close;
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select, textarea, [tabindex="0"]',
        ) || [],
      ).filter((el) => el.getClientRects().length > 0);
    (
      dialog?.querySelector<HTMLElement>("[data-autofocus]") || focusable()[0]
    )?.focus();
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose.current();
      }
      if (event.key === "Tab") {
        const items = focusable();
        const first = items[0],
          last = items.at(-1);
        if (!dialog?.contains(document.activeElement)) {
          event.preventDefault();
          first?.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", keyboard);
    return () => {
      document.body.style.overflow = priorOverflow;
      document.removeEventListener("keydown", keyboard);
      previous?.focus();
    };
    // A dialog's lifecycle depends on its presence, not the changing inline callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, identity]);
}
