import React from 'react';
import { cx } from '../../../theme/liquidGlass';
import GlassPill from './GlassPill';

interface GlassChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  modern?: boolean;
}

const GlassChip: React.FC<GlassChipProps> = ({ className, active = false, children, modern, ...props }) => {
  return (
    <GlassPill active={active} modern={modern} className={cx('px-3 py-1.5 text-xs', className)} {...props}>
      {children}
    </GlassPill>
  );
};

export default GlassChip;
