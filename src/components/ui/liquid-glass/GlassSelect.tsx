import React from 'react';
import { cx, focusRing, glassControl } from '../../../theme/liquidGlass';

interface GlassSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  modern?: boolean;
}

const GlassSelect: React.FC<GlassSelectProps> = ({
  className,
  options,
  placeholder,
  value,
  ...props
}) => {
  return (
    <label className={cx('relative rounded-full border px-4 py-2.5 text-muted', glassControl, focusRing)}>
      <select
        value={value}
        className={cx('w-full appearance-none bg-transparent pr-7 text-sm text-text focus:outline-none', className)}
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
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted2">▾</span>
    </label>
  );
};

export default GlassSelect;
