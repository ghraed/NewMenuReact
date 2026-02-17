import React from 'react';
import { cn } from '../../../utils/cn';
import type { ToastState } from './useGlassToast';

interface GlassToastProps {
  toast: ToastState;
  onClose?: () => void;
  className?: string;
}

const toneClass: Record<NonNullable<ToastState['tone']>, string> = {
  primary: 'from-lg-primary/60 to-white/35',
  secondary: 'from-lg-secondary/60 to-white/35',
  tertiary: 'from-lg-tertiary/60 to-white/35',
  neutral: 'from-slate-200/70 to-white/35',
};

const GlassToast: React.FC<GlassToastProps> = ({ toast, onClose, className }) => {
  const tone = toast.tone || 'primary';

  return (
    <div
      aria-live="polite"
      className={cn(
        'pointer-events-none fixed right-4 top-4 z-[120] transition-all duration-300 ease-fluid',
        toast.open ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
      )}
    >
      <div className={cn('pointer-events-auto relative overflow-hidden rounded-2xl border border-white/50 bg-white/45 px-4 py-3 shadow-glass-strong backdrop-blur-2xl', className)}>
        <span className={cn('absolute inset-0 bg-gradient-to-br opacity-80', toneClass[tone])} />
        <span className="absolute -left-10 top-0 h-full w-14 rotate-12 bg-white/45 blur-md" />
        <div className="relative z-10 flex items-center gap-3">
          <span className="text-sm font-medium text-lg-text">{toast.message}</span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-2 py-1 text-xs text-lg-muted hover:bg-white/60 lg-focus-ring"
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
