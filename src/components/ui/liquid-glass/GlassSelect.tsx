import React from 'react';
import { cx, getModernMode, glassControl } from '../../../theme/liquidGlass';

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
  modern,
  ...props
}) => {
  const resolvedModern = modern ?? getModernMode();

  return (
    <div className={cx('relative rounded-full border px-4 py-2.5', glassControl(resolvedModern), 'lg-lift-sm')}>
      <select
        value={value}
        className={cx('w-full appearance-none bg-transparent pr-7 text-sm text-lg-text focus:outline-none', className)}
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
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-700/70">▾</span>
    </div>
  );
};

export default GlassSelect;
