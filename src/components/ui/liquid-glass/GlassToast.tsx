import React from 'react';
import { cx } from '../../../theme/liquidGlass';
import type { ToastState } from './useGlassToast';

interface GlassToastProps {
  toast: ToastState;
  onClose?: () => void;
  className?: string;
}

const toneClass: Record<NonNullable<ToastState['tone']>, string> = {
  primary: 'border-gold/50 bg-gold/20 text-text',
  secondary: 'border-sage/45 bg-sage/18 text-text',
  tertiary: 'border-white/25 bg-white/12 text-text',
};

const GlassToast: React.FC<GlassToastProps> = ({ toast, onClose, className }) => {
  const tone = toast.tone || 'primary';

  return (
    <div
      aria-live="polite"
      className={cx(
        'pointer-events-none fixed right-4 top-4 z-[120] transition-all duration-300 ease-fluid motion-reduce:transition-none',
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
              className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-xs text-muted transition hover:bg-white/16 hover:text-text"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GlassToast;
