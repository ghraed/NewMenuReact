import React from 'react';
import { cx, glassSurface } from '../../../theme/liquidGlass';

interface GlassBoardProps extends React.HTMLAttributes<HTMLDivElement> {
  modern?: boolean;
}

const GlassBoard: React.FC<GlassBoardProps> = ({ className, children, ...props }) => {
  return (
    <div
      className={cx(
        'relative overflow-hidden rounded-2xl p-4 sm:p-6',
        glassSurface,
        className
      )}
      {...props}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default GlassBoard;
