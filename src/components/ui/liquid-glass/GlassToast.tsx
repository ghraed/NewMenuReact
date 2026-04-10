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
  primary: 'border-[#8faa14] bg-[#b5d81a] text-[#233000] supports-[backdrop-filter]:bg-[#b5d81a]/92',
  secondary: 'border-[#8faa14] bg-[#b5d81a] text-[#233000] supports-[backdrop-filter]:bg-[#b5d81a]/92',
  tertiary: 'border-red-800 bg-red-700 text-white supports-[backdrop-filter]:bg-red-700/92',
};

const toneTextClass: Record<NonNullable<ToastState['tone']>, string> = {
  primary: 'text-[#233000]',
  secondary: 'text-[#233000]',
  tertiary: 'text-white',
};

const toneCloseClass: Record<NonNullable<ToastState['tone']>, string> = {
  primary: 'text-[#233000]/80 hover:text-[#233000]',
  secondary: 'text-[#233000]/80 hover:text-[#233000]',
  tertiary: 'text-white/90 hover:text-white',
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
      <div
        className={cx(
          'pointer-events-auto relative rounded-2xl border px-4 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl ring-1 ring-white/20',
          toneClass[tone],
          className
        )}
      >
        <div className="relative z-10 flex items-center gap-3">
          <span className={cx('text-sm font-medium', toneTextClass[tone])}>{toast.message}</span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close toast"
              className={cx('text-sm font-semibold leading-none transition', toneCloseClass[tone])}
            >
              X
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
