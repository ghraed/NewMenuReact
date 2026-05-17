import React from 'react';
import { cx } from '../../../theme/liquidGlass';

interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  modern?: boolean;
}

const GlassInput = React.forwardRef<HTMLInputElement, GlassInputProps>(({
  className,
  leftSlot,
  rightSlot,
  ...props
}, ref) => {
  const hasSlots = Boolean(leftSlot || rightSlot);
  return (
    <div className={cx('relative')}>
      {leftSlot && <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted2">{leftSlot}</span>}
      <input
        ref={ref}
        className={cx(
          'w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text placeholder:text-muted2 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/55',
          hasSlots ? 'pl-10' : '',
          rightSlot ? 'pr-10' : '',
          className
        )}
        {...props}
      />
      {rightSlot && <span className="pointer-events-none absolute right-3 top-1/2 z-10 -translate-y-1/2 text-muted2">{rightSlot}</span>}
    </div>
  );
});

GlassInput.displayName = 'GlassInput';

export default GlassInput;
