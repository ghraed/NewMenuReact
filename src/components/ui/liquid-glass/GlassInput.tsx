import React from 'react';
import { cx, getModernMode, glassControl } from '../../../theme/liquidGlass';

interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  modern?: boolean;
}

const GlassInput: React.FC<GlassInputProps> = ({
  className,
  leftSlot,
  rightSlot,
  modern,
  ...props
}) => {
  const resolvedModern = modern ?? getModernMode();

  return (
    <div className={cx('relative flex items-center gap-2 rounded-full border px-4 py-2.5', glassControl(resolvedModern), 'lg-lift-sm')}>
      {leftSlot && <span className="relative z-10 text-slate-700/70">{leftSlot}</span>}
      <input
        className={cx(
          'relative z-10 w-full bg-transparent text-sm text-lg-text placeholder:text-slate-700/70 focus:outline-none',
          className
        )}
        {...props}
      />
      {rightSlot && <span className="relative z-10 text-slate-700/70">{rightSlot}</span>}
    </div>
  );
};

export default GlassInput;
