import React from 'react';
import { cx, getModernMode, glassSurface } from '../../../theme/liquidGlass';

interface GlassSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  sheen?: boolean;
  iridescent?: boolean;
  innerBorder?: boolean;
  modern?: boolean;
}

const GlassSurface: React.FC<GlassSurfaceProps> = ({
  className,
  children,
  sheen = true,
  iridescent = false,
  innerBorder = true,
  modern,
  ...props
}) => {
  const resolvedModern = modern ?? getModernMode();

  return (
    <div className={cx('relative overflow-hidden rounded-[28px] border', glassSurface(resolvedModern), className)} {...props}>
      {iridescent && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-lg-primary/25 via-transparent to-lg-secondary/25" />
      )}
      {sheen && <div className="pointer-events-none absolute -left-20 -top-14 h-40 w-[140%] rotate-[15deg] bg-white/15 blur-2xl" />}
      {innerBorder && <div className="pointer-events-none absolute inset-[1px] rounded-[26px] border border-white/20" />}
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default GlassSurface;
