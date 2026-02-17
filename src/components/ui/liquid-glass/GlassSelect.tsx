import React from 'react';
import { cn } from '../../../utils/cn';

interface GlassSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}

const GlassSelect: React.FC<GlassSelectProps> = ({
  className,
  options,
  placeholder,
  value,
  ...props
}) => {
  return (
    <div className="relative">
      <div className="lg-glass-panel rounded-2xl">
        <div className="lg-sheen" />
        <div className="lg-glass-inner-border rounded-2xl" />
        <select
          value={value}
          className={cn(
            'relative z-10 w-full appearance-none bg-transparent px-4 py-3 pr-10 text-sm text-lg-text',
            'lg-focus-ring rounded-2xl',
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-4 top-1/2 z-10 -translate-y-1/2 text-lg-muted">
          ▾
        </span>
      </div>
    </div>
  );
};

export default GlassSelect;
