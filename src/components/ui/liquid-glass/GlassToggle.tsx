import React from 'react';
import { cx } from '../../../theme/liquidGlass';

interface GlassToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  className?: string;
  disabled?: boolean;
  modern?: boolean;
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
    <label className={cx('flex items-center justify-between gap-4', disabled && 'cursor-not-allowed opacity-60', className)}>
      <span>
        {label && <span className="block text-sm font-semibold text-text">{label}</span>}
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>

      <span className="relative inline-flex items-center">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="h-7 w-12 rounded-full border border-stroke bg-panel2 transition duration-300" />
        <span
          className={cx(
            'absolute left-1 top-1 h-5 w-5 rounded-full bg-gold shadow-lux2 transition-transform duration-300',
            checked && 'translate-x-5'
          )}
        />
      </span>
    </label>
  );
};

export default GlassToggle;
