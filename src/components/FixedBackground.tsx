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
      <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-gold/18 blur-3xl" />
      <div className="absolute -right-16 top-10 h-64 w-64 rounded-full bg-sage/14 blur-3xl" />
      <div className="absolute bottom-[-80px] left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-gold/10 blur-3xl" />
    </div>
  );
};

export default FixedBackground;
