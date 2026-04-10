import React from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../../../theme/liquidGlass';
import type { ToastState } from './useGlassToast';

interface GlassToastProps {
  toast: ToastState;
  onClose?: () => void;
  className?: string;
}

const toneClass: Record<NonNullable<ToastState['tone']>, string> = {
  primary: 'border-gold/75 bg-gold/35 text-white shadow-[0_18px_40px_rgba(183,139,53,0.34)]',
  secondary: 'border-sage/70 bg-sage/32 text-white shadow-[0_18px_40px_rgba(74,122,103,0.32)]',
  tertiary: 'border-white/40 bg-black/72 text-white shadow-[0_18px_40px_rgba(0,0,0,0.34)]',
};

const GlassToast: React.FC<GlassToastProps> = ({ toast, onClose, className }) => {
  const tone = toast.tone || 'primary';

  const content = (
    <div
      aria-live="polite"
      className={cx(
        'pointer-events-none fixed right-4 top-4 z-[2147483647] transition-all duration-300 ease-fluid motion-reduce:transition-none',
        toast.open ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
      )}
    >
      <div className={cx('pointer-events-auto relative rounded-xl2 border px-4 py-3 backdrop-blur-xl shadow-lux2 lg-noise', toneClass[tone], className)}>
        <div className="relative z-10 flex items-center gap-3">
          <span className="text-sm font-medium text-text">{toast.message}</span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/30 bg-white/12 px-2 py-1 text-xs text-white/90 transition hover:bg-white/20 hover:text-white"
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
