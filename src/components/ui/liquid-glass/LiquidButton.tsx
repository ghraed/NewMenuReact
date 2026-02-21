import React from 'react';
import {
  cx,
  focusRing,
  glassControl,
  glassInteractive,
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
  disabled,
  ...props
}) => {
  return (
    <button
      className={cx(
        'group relative inline-flex items-center justify-center overflow-hidden rounded-full px-5 py-2.5 font-semibold text-text',
        glassControl,
        glassInteractive,
        focusRing,
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
      disabled={disabled}
      {...props}
    >
      <span className={cx('pointer-events-none absolute inset-0 bg-gradient-to-r opacity-95', toneGradient[tone])} />
      <span className="pointer-events-none absolute -left-12 top-0 h-full w-16 rotate-12 bg-white/30 blur-lg transition-transform duration-500 motion-reduce:transition-none group-hover:translate-x-64" />
      <span className="relative z-10">{children}</span>
    </button>
  );
};

export default LiquidButton;
