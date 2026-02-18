import React from 'react';
import {
  cx,
  getModernMode,
  glassControl,
  glassControlNoShadow,
} from '../../../theme/liquidGlass';

type Tone = 'primary' | 'secondary' | 'tertiary';

interface LiquidButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
  modern?: boolean;
  noShadow?: boolean;
}

const toneBg: Record<Tone, string> = {
  primary: '!bg-lg-primary/55 !border-lg-primary/45 !text-white',
  secondary: '!bg-lg-secondary/50 !border-lg-secondary/45 !text-white',
  tertiary: '!bg-lg-tertiary/78 !border-white/45 !text-lg-text',
};

const LiquidButton: React.FC<LiquidButtonProps> = ({
  className,
  children,
  tone = 'primary',
  modern,
  noShadow = false,
  disabled,
  ...props
}) => {
  const resolvedModern = modern ?? getModernMode();

  return (
    <button
      className={cx(
        'group relative inline-flex items-center justify-center overflow-hidden rounded-full border px-5 py-2.5 font-semibold text-lg-text transition duration-300 ease-fluid',
        'hover:scale-[1.03] hover:-translate-y-[1px] active:scale-[0.97]',
        disabled && 'cursor-not-allowed opacity-60',
        noShadow ? glassControlNoShadow(resolvedModern) : glassControl(resolvedModern),
        !noShadow && 'lg-lift-sm',
        toneBg[tone],
        className
      )}
      disabled={disabled}
      {...props}
    >
      <span className="pointer-events-none absolute -left-14 top-0 h-full w-20 rotate-12 bg-white/35 blur-lg transition-transform duration-500 group-hover:translate-x-72" />
      {!noShadow && (
        <span className="pointer-events-none absolute inset-0 opacity-0 shadow-[0_0_28px_rgba(255,255,255,0.35)] transition duration-300 group-hover:opacity-100" />
      )}
      <span className="relative z-10">{children}</span>
    </button>
  );
};

export default LiquidButton;
