import { cn } from '../utils/cn';

export const cx = (...classes: (string | boolean | undefined | null)[]) => cn(...classes);

export const primaryTone =
  '!bg-gold !text-bg0 !border-transparent enabled:hover:!bg-gold/92 enabled:hover:shadow-[0_2px_10px_rgba(0,0,0,0.26)]';
export const secondaryTone =
  'bg-sage/20 text-text border-sage/35 enabled:hover:bg-sage/28 enabled:hover:border-sage/50';
export const tertiaryTone =
  'bg-bg1/85 text-text border-stroke enabled:hover:bg-bg1 enabled:hover:border-white/22';

export const glassSurface =
  'border border-stroke bg-bg1 shadow-[0_1px_2px_rgba(0,0,0,0.24)]';

export const glassControl =
  'border border-stroke bg-bg1/95 shadow-[0_1px_2px_rgba(0,0,0,0.2)]';

export const glassSurfaceHover =
  [
    'motion-safe:hover:border-white/22',
    'motion-safe:hover:bg-bg1/98',
    'motion-safe:hover:shadow-[0_6px_18px_rgba(0,0,0,0.22)]',
  ].join(' ');

export const glassControlHover =
  'enabled:hover:border-white/20 enabled:hover:text-text enabled:hover:shadow-[0_4px_12px_rgba(0,0,0,0.18)]';

export const glassInteractive =
  'transition duration-150 ease-fluid motion-reduce:transition-none';

export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/55 focus-visible:ring-offset-2 focus-visible:ring-offset-bg1';

export const getModernMode = () => true;
