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
        'inline-flex items-center justify-center border px-4 py-2 text-sm font-medium text-muted',
        soft ? 'rounded-[26px]' : 'rounded-full',
        glassControl,
        !active && glassControlHover,
        glassInteractive,
        focusRing,
        active && '!border-gold/70 !bg-gold !text-bg0 enabled:hover:!border-gold enabled:hover:!bg-gold/95 enabled:hover:shadow-[0_14px_30px_rgba(212,175,55,0.18)]',
        className
      )}
      {...props}
    >
      <span className="relative z-10">{children}</span>
    </button>
  );
};

export default GlassPill;
