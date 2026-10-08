import React from 'react';
import { cx, glassSurface } from '../../../theme/liquidGlass';

interface GlassBoardProps extends React.HTMLAttributes<HTMLDivElement> {
  modern?: boolean;
  noShadow?: boolean;
}

const GlassBoard: React.FC<GlassBoardProps> = ({ className, children, noShadow = false, ...props }) => {
  return (
    <div
      className={cx(
        'relative overflow-hidden rounded-2xl p-4 sm:p-6',
        glassSurface,
        noShadow && '!shadow-none hover:!shadow-none !filter-none',
        className
      )}
      {...props}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default GlassBoard;
