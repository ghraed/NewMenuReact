import React from 'react';
import { cx, focusRing, glassControl, glassInteractive } from '../../../theme/liquidGlass';

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
        glassInteractive,
        focusRing,
        active && 'border-gold/40 bg-[linear-gradient(135deg,rgba(215,180,106,.22),rgba(255,255,255,.04))] text-text',
        className
      )}
      {...props}
    >
      <span className="relative z-10">{children}</span>
    </button>
  );
};

export default GlassPill;
