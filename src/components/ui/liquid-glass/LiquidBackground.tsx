import React from 'react';
import { cx } from '../../../theme/liquidGlass';

interface LiquidBackgroundProps {
  children: React.ReactNode;
  className?: string;
}

const LiquidBackground: React.FC<LiquidBackgroundProps> = ({ children, className }) => {
  return (
    <div className={cx('relative min-h-screen text-text', className)}>
      {children}
    </div>
  );
};

export default LiquidBackground;
