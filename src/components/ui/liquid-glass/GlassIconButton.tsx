import React from 'react';
import { cx, focusRing, glassControl, glassInteractive } from '../../../theme/liquidGlass';

interface GlassIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  modern?: boolean;
}

const GlassIconButton: React.FC<GlassIconButtonProps> = ({ className, children, ...props }) => {
  return (
    <button
      className={cx(
        'group relative inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border text-base text-text',
        glassControl,
        glassInteractive,
        focusRing,
        className
      )}
      {...props}
    >
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/20 via-white/5 to-transparent" />
      <span className="relative z-10">{children}</span>
    </button>
  );
};

export default GlassIconButton;
