import React from 'react';
import { cx, glassSurface } from '../../../theme/liquidGlass';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  modern?: boolean;
  interactive?: boolean;
  noise?: boolean;
}

const GlassCard: React.FC<GlassCardProps> = ({
  className,
  children,
  interactive = true,
  noise = true,
  ...props
}) => {
  return (
    <div
      className={cx(
        'relative isolate overflow-hidden rounded-xl2 p-4',
        glassSurface,
        interactive
          && 'transform-gpu transition duration-300 ease-fluid motion-reduce:transition-none motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-lux2',
        noise && 'lg-noise',
        className
      )}
      {...props}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default GlassCard;
