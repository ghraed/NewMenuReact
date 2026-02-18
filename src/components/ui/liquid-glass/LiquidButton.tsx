import React from 'react';
import {
  cx,
  getModernMode,
  glassControl,
  primaryGradient,
  secondaryGradient,
  tertiaryGradient,
} from '../../../theme/liquidGlass';

type Tone = 'primary' | 'secondary' | 'tertiary';

interface LiquidButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
  modern?: boolean;
}

const toneGradient: Record<Tone, string> = {
  primary: primaryGradient,
  secondary: secondaryGradient,
  tertiary: tertiaryGradient,
};

const LiquidButton: React.FC<LiquidButtonProps> = ({
  className,
  children,
  tone = 'primary',
  modern,
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
        glassControl(resolvedModern),
        'lg-lift-sm',
        className
      )}
      disabled={disabled}
      {...props}
    >
      <span className={cx('absolute inset-0 bg-gradient-to-r opacity-95', toneGradient[tone])} />
      <span className="pointer-events-none absolute -left-14 top-0 h-full w-20 rotate-12 bg-white/35 blur-lg transition-transform duration-500 group-hover:translate-x-72" />
      <span className="pointer-events-none absolute inset-0 opacity-0 shadow-[0_0_28px_rgba(255,255,255,0.35)] transition duration-300 group-hover:opacity-100" />
      <span className="relative z-10">{children}</span>
    </button>
  );
};

export default LiquidButton;
