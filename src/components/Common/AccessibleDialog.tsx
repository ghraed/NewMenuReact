import { useLayoutEffect, useRef, type ReactNode } from 'react';

// Native modal semantics provide focus containment, an inert background and
// focus restoration in Chromium, Firefox and WebKit without changing content.
const AccessibleDialog = ({ children, labelledBy, onDismiss }: {
  children: ReactNode;
  labelledBy: string;
  onDismiss: () => void;
}) => {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const invoker = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    // Close before React removes the node. Chromium otherwise loses the native
    // invoker when cleanup runs after removal; restore only a still-mounted control.
    return () => {
      dialog.close();
      if (invoker?.isConnected) invoker.focus();
    };
  }, []);

  return (
    <dialog ref={ref} aria-labelledby={labelledBy} aria-modal="true"
      className="fixed inset-0 m-0 flex h-dvh max-h-none w-screen max-w-none items-start justify-center border-0 bg-black/55 px-3 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] sm:items-center sm:p-6"
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]'))
          .filter((control) => control.tabIndex >= 0 && !control.hasAttribute('disabled') && control.getClientRects().length > 0);
        const first = controls[0];
        const last = controls.at(-1);
        if (!first || !last) { event.preventDefault(); return; }
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}
      onCancel={(event) => { event.preventDefault(); onDismiss(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onDismiss(); }}>
      {children}
    </dialog>
  );
};

export default AccessibleDialog;
