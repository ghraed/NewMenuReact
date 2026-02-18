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
        'relative min-h-screen overflow-hidden bg-gradient-to-br from-[hsl(var(--lg-bg-a))] via-[hsl(var(--lg-bg-b))] to-[hsl(var(--lg-bg-c))]',
        className
      )}
    >
      <div className="pointer-events-none absolute -left-24 top-2 h-80 w-80 rounded-full bg-gradient-to-br from-lg-primary/35 to-indigo-200/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-12 h-72 w-72 rounded-full bg-gradient-to-br from-lg-secondary/35 to-cyan-200/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-7rem] left-1/3 h-80 w-80 rounded-full bg-gradient-to-br from-fuchsia-200/20 to-lg-primary/30 blur-3xl" />
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default LiquidBackground;
