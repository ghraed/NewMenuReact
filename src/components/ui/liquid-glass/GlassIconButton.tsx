import React from 'react';
import { cx, focusRing, glassControl, glassControlHover, glassInteractive } from '../../../theme/liquidGlass';

interface GlassIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  modern?: boolean;
}

const GlassIconButton: React.FC<GlassIconButtonProps> = ({ className, children, ...props }) => {
  return (
    <button
      className={cx(
        'group relative inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border text-base text-text',
        glassControl,
        glassControlHover,
        glassInteractive,
        focusRing,
        className
      )}
      {...props}
    >
      <span className="pointer-events-none absolute inset-0 bg-white/10 transition-colors duration-300 group-hover:bg-white/14" />
      <span className="relative z-10">{children}</span>
    </button>
  );
};

export default GlassIconButton;
