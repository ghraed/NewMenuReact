import React from 'react';
import { cn } from '../../../utils/cn';

interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

const GlassInput: React.FC<GlassInputProps> = ({ className, leftSlot, rightSlot, ...props }) => {
  return (
    <div className="relative">
      <div className="lg-glass-panel rounded-2xl">
        <div className="lg-sheen" />
        <div className="lg-glass-inner-border rounded-2xl" />
        <div className="relative z-10 flex items-center gap-2 px-3 py-2">
          {leftSlot && <span className="text-lg-muted">{leftSlot}</span>}
          <input
            className={cn(
              'w-full bg-transparent text-sm text-lg-text placeholder:text-lg-muted/75',
              'border-0 outline-none ring-0',
              'lg-focus-ring rounded-lg px-1 py-1',
              className
            )}
            {...props}
          />
          {rightSlot && <span className="text-lg-muted">{rightSlot}</span>}
        </div>
      </div>
    </div>
  );
};

export default GlassInput;
