import React from 'react';
import { cx, glassSurface } from '../../../theme/liquidGlass';

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
  ...props
}) => {
  return (
    <div className={cx('relative overflow-hidden rounded-xl', glassSurface, className)} {...props}>
      {iridescent && (
        <div className="pointer-events-none absolute inset-0 bg-gold/8" />
      )}
      {sheen && <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/8 to-transparent" />}
      {innerBorder && <div className="pointer-events-none absolute inset-[1px] rounded-[11px] border border-white/8" />}
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default GlassSurface;
