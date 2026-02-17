import React from 'react';
import { cn } from '../../../utils/cn';

interface LiquidBackgroundProps {
  children: React.ReactNode;
  className?: string;
}

const LiquidBackground: React.FC<LiquidBackgroundProps> = ({ children, className }) => {
  return (
    <div className={cn('lg-app-bg', className)}>
      <div className="lg-blob -left-24 -top-24 h-72 w-72 bg-lg-primary/35" />
      <div className="lg-blob right-[-5rem] top-16 h-72 w-72 bg-lg-secondary/30" />
      <div className="lg-blob bottom-[-8rem] left-1/2 h-80 w-80 -translate-x-1/2 bg-lg-tertiary/28" />
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default LiquidBackground;
