import React from 'react';
import { cn } from '../utils/cn';

interface FixedBackgroundProps {
  className?: string;
}

const FixedBackground: React.FC<FixedBackgroundProps> = ({ className }) => {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none fixed inset-0 -z-20 overflow-hidden',
        className
      )}
    >
      <div className="absolute inset-0 bg-bg0" />
    </div>
  );
};

export default FixedBackground;
