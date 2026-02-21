import React from 'react';
import { cx, glassSurface } from '../../../theme/liquidGlass';

interface GlassBoardProps extends React.HTMLAttributes<HTMLDivElement> {
  modern?: boolean;
}

const GlassBoard: React.FC<GlassBoardProps> = ({ className, children, ...props }) => {
  return (
    <div
      className={cx(
        'relative overflow-hidden rounded-[30px] p-5 sm:p-7',
        glassSurface,
        'lg-noise',
        className
      )}
      {...props}
    >
      <div className="pointer-events-none absolute inset-[1px] rounded-[28px] border border-white/8" />
      <div className="pointer-events-none absolute -left-32 -top-24 h-52 w-[150%] rotate-[16deg] bg-gold/8 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-48 w-[130%] rotate-[-12deg] bg-sage/8 blur-3xl" />
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default GlassBoard;
