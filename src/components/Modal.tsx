"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Elements that can hold keyboard focus, in the order Tab should visit them.
 *
 * `[tabindex]:not([tabindex="-1"])` is intentionally absent from this list. It
 * matches the dialog panel itself, which carries tabIndex={-1} precisely so it
 * is programmatically focusable but skipped during normal tabbing - if it were
 * counted, the trap below would land on the panel instead of a real control.
 *
 * Note the selectors match on the type attribute alone: `:not([type="button"])`
 * is not a reliable way to skip the icon-only buttons in the icon picker, and
 * getting this wrong only means an extra Tab stop, not a broken form.
 */
const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * The one modal in the app.
 *
 * Handles the boring-but-must-have accessibility bits once: Escape closes,
 * Tab is trapped inside, focus returns to whatever opened it, the page
 * behind doesn't scroll, and the backdrop is inert to screen readers.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  maxWidth = "max-w-lg",
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: string;
  footer?: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  // `onClose` is usually an inline arrow at the call site, so it is a brand new
  // function on every render. Listing it in the effect's dependencies therefore
  // re-ran the whole setup/teardown cycle on every keystroke typed into the
  // dialog: cleanup fired (returning focus to the button that opened it) and
  // setup fired again (grabbing focus for itself). The net effect was focus
  // being torn away from a text field after each character, which is what made
  // the close button light up while someone was typing a description.
  //
  // Holding the callback in a ref lets the effect depend on `open` alone, so it
  // genuinely runs once per open/close instead of once per render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    restoreTo.current = document.activeElement as HTMLElement | null;
    const { overflow, paddingRight } = document.body.style;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;

    /**
     * Is this element actually visible and able to take focus?
     *
     * Must NOT use offsetParent. The backdrop is position:fixed, and
     * offsetParent is null for every descendant of a fixed element — so that
     * check discarded the entire dialog, leaving the focus trap with nothing to
     * work on and focus free to wander outside the modal entirely.
     */
    const isVisible = (n: HTMLElement) => {
      if (n.hasAttribute("disabled") || n.getAttribute("aria-hidden") === "true") return false;
      const r = n.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return false;
      const cs = getComputedStyle(n);
      return cs.visibility !== "hidden" && cs.display !== "none";
    };

    const controls = () =>
      Array.from(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(isVisible);

    // Focus the first real control rather than the close button, which is the
    // first focusable node in DOM order.
    //
    // This has to be a JS filter rather than a smarter selector: FOCUSABLE is a
    // comma-separated list, so appending `:not(...)` to the string only applies
    // it to the final selector and leaves `button:not([disabled])` matching the
    // close button anyway.
    const all = controls();
    const first = all.find((n) => !n.hasAttribute("data-modal-close")) ?? all[0];
    (first ?? panel.current)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;

      const nodes = controls();
      if (nodes.length === 0) return;

      const firstNode = nodes[0];
      const lastNode = nodes[nodes.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === firstNode || !panel.current!.contains(active))) {
        e.preventDefault();
        lastNode.focus();
      } else if (!e.shiftKey && active === lastNode) {
        e.preventDefault();
        firstNode.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      restoreTo.current?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-v-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`surface max-h-[90vh] w-full overflow-y-auto rounded-b-none p-6 shadow-xl outline-none sm:rounded-[14px] ${maxWidth}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            {description && (
              <p className="mt-1 text-[0.8125rem] text-v-500 dark:text-v-400">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            data-modal-close
            className="-mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-[8px] text-v-400 transition-colors hover:bg-v-100 hover:text-v-700 dark:hover:bg-v-800 dark:hover:text-v-200"
          >
            <X className="size-4" />
          </button>
        </div>

        {children}

        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
