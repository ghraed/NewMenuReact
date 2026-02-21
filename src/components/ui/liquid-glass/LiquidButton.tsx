import React from 'react';
import {
  cx,
  focusRing,
  glassControl,
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
        'group relative inline-flex items-center justify-center rounded-full border px-5 py-2.5 font-semibold',
        glassControl,
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
