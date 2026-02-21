import React from 'react';
import { cx, glassInteractive, glassSurface } from '../../../theme/liquidGlass';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  modern?: boolean;
}

const GlassCard: React.FC<GlassCardProps> = ({ className, children, ...props }) => {
  return (
    <div
      className={cx(
        'relative overflow-hidden rounded-xl2 p-4',
        glassSurface,
        glassInteractive,
        'lg-noise',
        className
      )}
      {...props}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default GlassCard;
