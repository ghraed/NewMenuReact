import React from 'react';
import { cx } from '../../../theme/liquidGlass';

interface LiquidBackgroundProps {
  children: React.ReactNode;
  className?: string;
}

const LiquidBackground: React.FC<LiquidBackgroundProps> = ({ children, className }) => {
  return (
    <div
      className={cx(
        'relative min-h-screen overflow-hidden bg-[hsl(var(--lg-tertiary))]',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-white/20 backdrop-blur-[2px]" />
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default LiquidBackground;
