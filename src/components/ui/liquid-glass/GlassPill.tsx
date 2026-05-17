import React from 'react';
import { cx, focusRing, glassControl, glassControlHover, glassInteractive } from '../../../theme/liquidGlass';

interface GlassPillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  modern?: boolean;
  active?: boolean;
  soft?: boolean;
}

const GlassPill: React.FC<GlassPillProps> = ({
  className,
  children,
  active = false,
  soft = false,
  ...props
}) => {
  return (
    <button
      className={cx(
        'inline-flex min-h-9 items-center justify-center border px-4 py-1.5 text-sm font-medium text-muted',
        soft ? 'rounded-full' : 'rounded-full',
        glassControl,
        !active && glassControlHover,
        glassInteractive,
        focusRing,
        active && '!border-gold/65 !bg-gold/22 !text-text enabled:hover:!border-gold enabled:hover:!bg-gold/26',
        className
      )}
      {...props}
    >
      <span className="relative z-10">{children}</span>
    </button>
  );
};

export default GlassPill;
