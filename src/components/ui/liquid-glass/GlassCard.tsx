import React from 'react';
import { cx, glassSurface, glassSurfaceHover } from '../../../theme/liquidGlass';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  modern?: boolean;
  noShadow?: boolean;
  interactive?: boolean;
  noise?: boolean;
}

const GlassCard: React.FC<GlassCardProps> = ({
  className,
  children,
  interactive = true,
  noise = false,
  noShadow = false,
  ...props
}) => {
  return (
    <div
      className={cx(
        'relative isolate overflow-hidden rounded-2xl p-4',
        glassSurface,
        interactive && glassSurfaceHover,
        interactive && 'transform-gpu transition duration-300 ease-fluid motion-reduce:transition-none',
        noise && 'lg-noise',
        noShadow && '!shadow-none hover:!shadow-none !filter-none',
        className
      )}
      {...props}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default GlassCard;
