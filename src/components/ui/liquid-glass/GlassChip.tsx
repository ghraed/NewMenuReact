import React from 'react';
import { cn } from '../../../utils/cn';

interface GlassChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

const GlassChip: React.FC<GlassChipProps> = ({ className, active = false, children, ...props }) => {
  return (
    <button
      className={cn(
        'rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-300 ease-fluid lg-focus-ring',
        active
          ? 'border-white/65 bg-white/60 text-lg-text shadow-glow-primary'
          : 'border-white/45 bg-white/35 text-lg-muted hover:bg-white/55',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

export default GlassChip;
