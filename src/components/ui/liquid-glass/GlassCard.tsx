import React from 'react';
import { cx, getModernMode, glassSurface } from '../../../theme/liquidGlass';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  modern?: boolean;
}

const GlassCard: React.FC<GlassCardProps> = ({ className, children, modern, ...props }) => {
  const resolvedModern = modern ?? getModernMode();

  return (
    <div
      className={cx(
        'relative overflow-hidden rounded-[28px] border p-4 transition duration-300 ease-fluid hover:scale-[1.03] hover:-translate-y-[1px] active:scale-[0.97]',
        glassSurface(resolvedModern),
        className
      )}
      {...props}
    >
      <div className="pointer-events-none absolute -right-12 -top-16 h-28 w-28 rounded-full bg-lg-primary/30 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-10 h-24 w-24 rounded-full bg-lg-secondary/35 blur-2xl" />
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default GlassCard;
