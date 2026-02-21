import React from 'react';
import { cx, focusRing, glassControl } from '../../../theme/liquidGlass';

interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  modern?: boolean;
}

const GlassInput: React.FC<GlassInputProps> = ({
  className,
  leftSlot,
  rightSlot,
  ...props
}) => {
  return (
    <label className={cx('relative flex items-center gap-2 rounded-full border px-4 py-2.5 text-muted', glassControl, focusRing)}>
      {leftSlot && <span className="relative z-10 text-muted2">{leftSlot}</span>}
      <input
        className={cx(
          'relative z-10 w-full bg-transparent text-sm text-text placeholder:text-muted2 focus:outline-none',
          className
        )}
        {...props}
      />
      {rightSlot && <span className="relative z-10 text-muted2">{rightSlot}</span>}
    </label>
  );
};

export default GlassInput;
