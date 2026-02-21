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
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default GlassBoard;
