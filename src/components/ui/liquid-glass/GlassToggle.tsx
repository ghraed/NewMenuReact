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
        <span className="h-8 w-14 rounded-full border border-stroke bg-bg1 transition duration-300 peer-checked:border-gold/45 peer-checked:bg-gold/25" />
        <span
          className={cx(
            'absolute left-1 top-1 h-6 w-6 rounded-full bg-white/90 shadow-[0_1px_4px_rgba(0,0,0,0.3)] transition-transform duration-300',
            checked && 'translate-x-6 bg-gold'
          )}
        />
      </span>
    </label>
  );
};

export default GlassToggle;
