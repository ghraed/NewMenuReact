import React from 'react';
import { cn } from '../../../utils/cn';

interface GlassSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  sheen?: boolean;
  iridescent?: boolean;
  innerBorder?: boolean;
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
    <div className={cn('lg-glass-panel', className)} {...props}>
      {iridescent && <div className="lg-iridescent" />}
      {sheen && <div className="lg-sheen" />}
      {innerBorder && <div className="lg-glass-inner-border" />}
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default GlassSurface;
