import React from 'react';
import { cx, primaryGradient, secondaryGradient, tertiaryGradient } from '../../../theme/liquidGlass';
import type { ToastState } from './useGlassToast';

interface GlassToastProps {
  toast: ToastState;
  onClose?: () => void;
  className?: string;
}

const toneClass: Record<NonNullable<ToastState['tone']>, string> = {
  primary: primaryGradient,
  secondary: secondaryGradient,
  tertiary: tertiaryGradient,
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
      <div className={cx('pointer-events-auto relative overflow-hidden rounded-xl2 border border-stroke bg-panel2 px-4 py-3 backdrop-blur-xl shadow-lux2 lg-noise', className)}>
        <span className={cx('absolute inset-0 bg-gradient-to-r opacity-90', toneClass[tone])} />
        <div className="relative z-10 flex items-center gap-3">
          <span className="text-sm font-medium text-text">{toast.message}</span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-xs text-muted transition hover:bg-white/20"
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
