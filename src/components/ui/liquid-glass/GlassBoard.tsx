import React from 'react';
import { cx, getModernMode, glassSurface } from '../../../theme/liquidGlass';

interface GlassBoardProps extends React.HTMLAttributes<HTMLDivElement> {
  modern?: boolean;
}

const GlassBoard: React.FC<GlassBoardProps> = ({ className, children, modern, ...props }) => {
  const resolvedModern = modern ?? getModernMode();

  return (
    <div
      className={cx(
        'relative overflow-hidden rounded-[42px] border p-6 sm:p-8',
        glassSurface(resolvedModern),
        className
      )}
      {...props}
    >
      <div className="pointer-events-none absolute inset-0 rounded-[42px] border border-white/20" />
      <div className="pointer-events-none absolute inset-[10px] rounded-[34px] border border-white/14" />

      <div className="pointer-events-none absolute -left-24 -top-20 h-56 w-[160%] rotate-[18deg] bg-white/12 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-10 h-44 w-[140%] rotate-[-18deg] bg-white/12 blur-3xl" />

      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default GlassBoard;
