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
  const tone = toast.tone || 'primary';
  const durationMs = Math.max(600, toast.durationMs ?? 2200);
  const isDarkTheme = typeof document !== 'undefined'
    ? window.getComputedStyle(document.documentElement).colorScheme === 'dark'
    : true;

  if (!toast.open) {
    return null;
  }

  const toneIcon: Record<NonNullable<ToastState['tone']>, string> = {
    primary: '✓',
    secondary: 'i',
    tertiary: '×',
  };

  const toneTitle: Record<NonNullable<ToastState['tone']>, string> = {
    primary: 'Update',
    secondary: 'Info',
    tertiary: 'Error',
  };

  const toneShell: Record<NonNullable<ToastState['tone']>, string> = {
    primary: '',
    secondary: '',
    tertiary: '',
  };

  const toneBadge: Record<NonNullable<ToastState['tone']>, string> = {
    primary: 'border-emerald-200 bg-emerald-500 text-white',
    secondary: 'border-sky-200 bg-sky-500 text-white',
    tertiary: 'border-rose-200 bg-rose-500 text-white',
  };

  const toneProgress: Record<NonNullable<ToastState['tone']>, string> = {
    primary: 'bg-[linear-gradient(90deg,#27c279,#1da965)]',
    secondary: 'bg-[linear-gradient(90deg,#2f98ff,#1f7ae0)]',
    tertiary: 'bg-[linear-gradient(90deg,#f14668,#de2f52)]',
  };
  const surfaceClass = isDarkTheme
    ? 'border-white/10 bg-[linear-gradient(180deg,rgba(18,18,22,0.96),rgba(10,10,14,0.96))] ring-white/10'
    : 'border-black/5 bg-[linear-gradient(180deg,#ffffff,#fbfbfd)] ring-black/5';
  const titleTextClass = isDarkTheme ? 'text-white/94' : 'text-black/88';
  const mutedTextClass = isDarkTheme ? 'text-white/68' : 'text-black/60';
  const closeTextClass = isDarkTheme ? 'text-white/55 hover:text-white/88' : 'text-black/45 hover:text-black/75';

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
          'relative w-[min(92vw,22rem)] overflow-hidden rounded-xl border px-4 py-3 shadow-[0_10px_26px_rgba(14,20,30,0.12)] ring-1 backdrop-blur-md',
          surfaceClass,
          toneShell[tone],
          className
        )}
      >
        <div className={cx('pointer-events-none absolute inset-0', isDarkTheme
          ? 'bg-[radial-gradient(120%_90%_at_0%_0%,rgba(255,255,255,0.12),transparent_58%)]'
          : 'bg-[radial-gradient(120%_90%_at_0%_0%,rgba(255,255,255,0.6),transparent_58%)]')}
        />
        <div className="relative z-10 flex items-center gap-3">
          <span
            className={cx(
              'inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-[11px] font-bold',
              toneBadge[tone]
            )}
          >
            {toneIcon[tone]}
          </span>
          <div className="min-w-0">
            <p className={cx('text-[13px] font-semibold leading-4', titleTextClass)}>{toneTitle[tone]}</p>
            <p className={cx('mt-1 text-[12px] leading-4', mutedTextClass)}>{toast.message}</p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close toast"
              className={cx(
                'ml-auto inline-flex h-6 w-6 items-center justify-center rounded-md text-sm font-semibold leading-none transition',
                isDarkTheme ? 'hover:bg-white/10' : 'hover:bg-black/5',
                closeTextClass
              )}
            >
              ×
            </button>
          )}
        </div>
        <div className={cx('absolute inset-x-0 bottom-0 h-[3px] overflow-hidden', isDarkTheme ? 'bg-white/10' : 'bg-black/[0.04]')}>
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
