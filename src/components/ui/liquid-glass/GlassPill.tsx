import React from 'react';
import { cx, getModernMode, glassControl, primaryGradient } from '../../../theme/liquidGlass';

interface GlassPillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  modern?: boolean;
  active?: boolean;
  soft?: boolean;
}

const GlassPill: React.FC<GlassPillProps> = ({
  className,
  children,
  modern,
  active = false,
  soft = false,
  ...props
}) => {
  const resolvedModern = modern ?? getModernMode();

  return (
    <button
      className={cx(
        'group relative inline-flex items-center justify-center overflow-hidden border px-4 py-2 text-sm font-semibold text-lg-text transition duration-300 ease-fluid hover:scale-[1.03] hover:-translate-y-[1px] active:scale-[0.97]',
        soft ? 'rounded-[26px]' : 'rounded-full',
        glassControl(resolvedModern),
        'lg-lift-sm',
        active && `border-white/45 bg-gradient-to-r ${primaryGradient}`,
        className
      )}
      {...props}
    >
      <span className="relative z-10">{children}</span>
    </button>
  );
};

export default GlassPill;
