import React from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../../../theme/liquidGlass';
import type { ToastState } from './useGlassToast';

interface GlassToastProps {
  toast: ToastState;
  onClose?: () => void;
  className?: string;
}

const GlassToast: React.FC<GlassToastProps> = ({ toast, onClose, className }) => {
  const content = (
    <div
      aria-live="polite"
      className={cx(
        'pointer-events-none fixed right-4 top-4 z-[2147483647] transition-all duration-300 ease-fluid motion-reduce:transition-none',
        toast.open ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
      )}
    >
      <div
        className={cx(
          'pointer-events-auto relative rounded-2xl border border-black/10 bg-white px-4 py-3 text-black shadow-[0_18px_40px_rgba(0,0,0,0.22)]',
          className
        )}
      >
        <div className="relative z-10 flex items-center gap-3">
          <span className="text-sm font-medium text-black">{toast.message}</span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-black/10 bg-black/[0.04] px-2 py-1 text-xs text-black/80 transition hover:bg-black/[0.08] hover:text-black"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return content;
  }

  return createPortal(content, document.body);
};

export default GlassToast;
