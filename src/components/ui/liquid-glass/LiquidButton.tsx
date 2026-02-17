import React from 'react';
import { cn } from '../../../utils/cn';

type Tone = 'primary' | 'secondary' | 'tertiary' | 'neutral';

interface LiquidButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
}

const gradientByTone: Record<Tone, string> = {
  primary: 'from-lg-primary/75 via-lg-primary/55 to-white/45',
  secondary: 'from-lg-secondary/75 via-lg-secondary/55 to-white/45',
  tertiary: 'from-lg-tertiary/75 via-lg-tertiary/55 to-white/45',
  neutral: 'from-slate-200/70 via-white/45 to-slate-100/70',
};

const glowByTone: Record<Tone, string> = {
  primary: 'hover:shadow-glow-primary',
  secondary: 'hover:shadow-glow-secondary',
  tertiary: 'hover:shadow-glow-tertiary',
  neutral: 'hover:shadow-glass-soft',
};

const LiquidButton: React.FC<LiquidButtonProps> = ({
  className,
  children,
  tone = 'primary',
  disabled,
  ...props
}) => {
  return (
    <button
      className={cn(
        'group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-2xl px-5 py-2.5 font-semibold text-lg-text transition-all duration-300 ease-fluid',
        'border border-white/55 bg-white/35 backdrop-blur-xl shadow-glass-soft lg-focus-ring',
        disabled ? 'cursor-not-allowed opacity-60' : cn('active:scale-[0.98] hover:-translate-y-0.5', glowByTone[tone]),
        className
      )}
      disabled={disabled}
      {...props}
    >
      <span className={cn('absolute inset-0 bg-gradient-to-br opacity-90 transition-opacity duration-300', gradientByTone[tone])} />
      <span className="absolute -left-14 top-0 h-full w-16 rotate-12 bg-white/50 blur-lg transition-transform duration-500 group-hover:translate-x-80" />
      <span className="relative z-10">{children}</span>
    </button>
  );
};

export default LiquidButton;
