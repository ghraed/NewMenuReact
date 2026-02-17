import React from 'react';
import { cn } from '../../../utils/cn';

interface GlassToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  className?: string;
  disabled?: boolean;
}

const GlassToggle: React.FC<GlassToggleProps> = ({
  checked,
  onChange,
  label,
  description,
  className,
  disabled = false,
}) => {
  return (
    <label className={cn('flex cursor-pointer items-center justify-between gap-4', disabled && 'cursor-not-allowed opacity-60', className)}>
      <span>
        {label && <span className="block text-sm font-semibold text-lg-text">{label}</span>}
        {description && <span className="block text-xs text-lg-muted">{description}</span>}
      </span>

      <span className="relative inline-flex">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span
          className={cn(
            'h-7 w-12 rounded-full border border-white/55 bg-white/45 backdrop-blur-xl transition-all duration-300',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-lg-primary/70 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-white/20',
            checked ? 'shadow-glow-primary' : 'shadow-glass-soft'
          )}
        />
        <span
          className={cn(
            'absolute left-1 top-1 h-5 w-5 rounded-full border border-white/50 bg-white/95 transition-transform duration-300',
            checked && 'translate-x-5'
          )}
        />
      </span>
    </label>
  );
};

export default GlassToggle;
