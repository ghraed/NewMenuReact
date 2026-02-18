import React from 'react';
import { cx, getModernMode, glassControl } from '../../../theme/liquidGlass';

interface GlassIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  modern?: boolean;
  tone?: 'primary' | 'secondary' | 'tertiary';
}

const toneClass: Record<NonNullable<GlassIconButtonProps['tone']>, string> = {
  primary: '!bg-lg-primary/35 !border-lg-primary/35 !text-white',
  secondary: '!bg-lg-secondary/35 !border-lg-secondary/35 !text-white',
  tertiary: '!bg-lg-tertiary/75 !border-white/45 !text-lg-text',
};

const GlassIconButton: React.FC<GlassIconButtonProps> = ({
  className,
  children,
  modern,
  tone = 'secondary',
  ...props
}) => {
  const resolvedModern = modern ?? getModernMode();

  return (
    <button
      className={cx(
        'group relative inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border text-lg text-lg-text transition duration-300 ease-fluid hover:scale-[1.03] hover:-translate-y-[1px] active:scale-[0.97]',
        glassControl(resolvedModern),
        'lg-lift-sm',
        toneClass[tone],
        className
      )}
      {...props}
    >
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/30 via-white/10 to-transparent" />
      <span className="relative z-10">{children}</span>
    </button>
  );
};

export default GlassIconButton;
