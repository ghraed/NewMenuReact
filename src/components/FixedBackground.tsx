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
      <div className="absolute inset-0 bg-[radial-gradient(58%_44%_at_12%_-8%,rgba(215,180,106,0.34),transparent_72%),radial-gradient(52%_40%_at_88%_0%,rgba(143,214,180,0.22),transparent_70%),radial-gradient(68%_52%_at_50%_118%,rgba(215,180,106,0.16),transparent_80%),linear-gradient(180deg,#0A1020_0%,#050813_100%)]" />
    </div>
  );
};

export default FixedBackground;
