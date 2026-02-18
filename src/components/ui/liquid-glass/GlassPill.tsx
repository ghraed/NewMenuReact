import React from 'react';
import { cx, getModernMode, glassControl, glassControlNoShadow } from '../../../theme/liquidGlass';

interface GlassPillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  modern?: boolean;
  active?: boolean;
  soft?: boolean;
  noShadow?: boolean;
}

const GlassPill: React.FC<GlassPillProps> = ({
  className,
  children,
  modern,
  active = false,
  soft = false,
  noShadow = false,
  ...props
}) => {
  const resolvedModern = modern ?? getModernMode();

  return (
    <button
      className={cx(
        'group relative inline-flex items-center justify-center overflow-hidden border px-4 py-2 text-sm font-semibold text-lg-text transition duration-300 ease-fluid hover:scale-[1.03] hover:-translate-y-[1px] active:scale-[0.97]',
        soft ? 'rounded-[26px]' : 'rounded-full',
        noShadow ? glassControlNoShadow(resolvedModern) : glassControl(resolvedModern),
        !noShadow && 'lg-lift-sm',
        active && '!border-lg-primary/40 !bg-lg-primary/22',
        className
      )}
      {...props}
    >
      <span className="relative z-10">{children}</span>
    </button>
  );
};

export default GlassPill;
