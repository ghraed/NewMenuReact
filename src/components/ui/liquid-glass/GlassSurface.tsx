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
    <div className={cx('relative overflow-hidden rounded-xl2', glassSurface, className)} {...props}>
      {iridescent && (
        <div className="pointer-events-none absolute inset-0 bg-gold/8" />
      )}
      {sheen && <div className="pointer-events-none absolute -left-16 -top-10 h-36 w-[130%] rotate-[15deg] bg-white/10 blur-2xl" />}
      {innerBorder && <div className="pointer-events-none absolute inset-[1px] rounded-[20px] border border-white/10" />}
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default GlassSurface;
