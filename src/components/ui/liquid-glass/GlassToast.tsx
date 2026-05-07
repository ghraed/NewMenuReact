import React from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../../../theme/liquidGlass';
import type { ToastState } from './useGlassToast';

interface GlassToastProps {
  toast: ToastState;
  onClose?: () => void;
  className?: string;
}

const toneTextClass: Record<NonNullable<ToastState['tone']>, string> = {
  primary: 'text-[#2b1f00]',
  secondary: 'text-[#2b1f00]',
  tertiary: 'text-white',
};

const toneCloseClass: Record<NonNullable<ToastState['tone']>, string> = {
  primary: 'text-[#2b1f00]/80 hover:text-[#2b1f00]',
  secondary: 'text-[#2b1f00]/80 hover:text-[#2b1f00]',
  tertiary: 'text-white/90 hover:text-white',
};

const GlassToast: React.FC<GlassToastProps> = ({ toast, onClose, className }) => {
  const tone = toast.tone || 'primary';
  const durationMs = Math.max(600, toast.durationMs ?? 2200);

  if (!toast.open) {
    return null;
  }

  const toneIcon: Record<NonNullable<ToastState['tone']>, string> = {
    primary: '✓',
    secondary: 'i',
    tertiary: '!',
  };

  const toneShell: Record<NonNullable<ToastState['tone']>, string> = {
    primary:
      'border-[#e4c16d]/70 bg-[linear-gradient(135deg,rgba(24,18,6,0.88),rgba(44,32,8,0.9))] text-[#f8e6b8] ring-[#f3d79a]/25',
    secondary:
      'border-[#dcc28a]/60 bg-[linear-gradient(135deg,rgba(14,20,33,0.88),rgba(18,32,52,0.9))] text-[#f6edd8] ring-white/20',
    tertiary:
      'border-[#ff8a80]/60 bg-[linear-gradient(135deg,rgba(65,12,16,0.9),rgba(88,20,24,0.92))] text-[#ffe6e3] ring-[#ffb8b1]/25',
  };

  const toneBadge: Record<NonNullable<ToastState['tone']>, string> = {
    primary: 'border-[#f3d79a]/55 bg-[#f3d79a]/18 text-[#ffe9b7]',
    secondary: 'border-white/35 bg-white/10 text-[#f8f0df]',
    tertiary: 'border-[#ffc4bd]/45 bg-[#ffb4aa]/20 text-[#ffe9e6]',
  };

  const toneProgress: Record<NonNullable<ToastState['tone']>, string> = {
    primary: 'bg-[linear-gradient(90deg,#f3d79a,#d9ab43)]',
    secondary: 'bg-[linear-gradient(90deg,#d9d0b9,#f1e8d2)]',
    tertiary: 'bg-[linear-gradient(90deg,#ff9e96,#ffd2cd)]',
  };

  const content = (
    <div
      aria-live="polite"
      className={cx(
        'fixed right-4 top-4 z-[2147483647] transition-all duration-300 ease-fluid motion-reduce:transition-none',
        'translate-y-0 opacity-100'
      )}
    >
      <div
        className={cx(
          'relative w-[min(92vw,30rem)] overflow-hidden rounded-2xl border px-4 py-3 shadow-[0_18px_46px_rgba(0,0,0,0.34)] ring-1 backdrop-blur-xl',
          toneShell[tone],
          className
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,rgba(255,255,255,0.18),transparent_55%)]" />
        <div className="relative z-10 flex items-center gap-3">
          <span
            className={cx(
              'inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border text-sm font-semibold',
              toneBadge[tone]
            )}
          >
            {toneIcon[tone]}
          </span>
          <span className={cx('text-sm font-medium leading-5', toneTextClass[tone])}>{toast.message}</span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close toast"
              className={cx(
                'ml-auto inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/10 text-sm font-semibold leading-none transition hover:bg-black/20',
                toneCloseClass[tone]
              )}
            >
              ×
            </button>
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden bg-white/10">
          <div
            key={toast.nonce}
            className={cx('h-full origin-left', toneProgress[tone])}
            style={{ animation: `lg-toast-shrink ${durationMs}ms linear forwards` }}
          />
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
