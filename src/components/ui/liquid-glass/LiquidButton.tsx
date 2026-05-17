import React from 'react';
import {
  cx,
  focusRing,
  glassControl,
  glassControlHover,
  glassInteractive,
  primaryTone,
  secondaryTone,
  tertiaryTone,
} from '../../../theme/liquidGlass';

type Tone = 'primary' | 'secondary' | 'tertiary';

interface LiquidButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
  modern?: boolean;
}

const toneClass: Record<Tone, string> = {
  primary: primaryTone,
  secondary: secondaryTone,
  tertiary: tertiaryTone,
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
        'group relative inline-flex min-h-10 items-center justify-center rounded-full border px-5 py-2 text-sm font-medium tracking-[0.01em]',
        glassControl,
        glassControlHover,
        glassInteractive,
        focusRing,
        toneClass[tone],
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
      disabled={disabled}
      {...props}
    >
      <span>{children}</span>
    </button>
  );
};

export default LiquidButton;
