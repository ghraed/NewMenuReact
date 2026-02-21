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
      <div className="pointer-events-none absolute -right-14 -top-16 h-28 w-28 rounded-full bg-gold/18 blur-2xl" />
      <div className="pointer-events-none absolute -left-8 bottom-0 h-24 w-24 rounded-full bg-sage/14 blur-2xl" />
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default GlassCard;
