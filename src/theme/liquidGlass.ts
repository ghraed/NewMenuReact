import { cn } from '../utils/cn';

export const cx = (...classes: (string | boolean | undefined | null)[]) => cn(...classes);

export const primaryTone = '!bg-gold !text-bg0 !border-gold/70';
export const secondaryTone = 'bg-sage/35 text-text border-sage/55';
export const tertiaryTone = 'bg-white/10 text-text border-white/20';

export const glassSurface =
  'bg-bg1 border border-stroke shadow-lux';

export const glassControl =
  'bg-bg1 border border-stroke shadow-lux2';

export const glassInteractive =
  'transition duration-300 ease-fluid motion-reduce:transition-none motion-safe:hover:-translate-y-0.5 motion-safe:hover:scale-[1.01] active:scale-[0.99]';

export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg1';

export const getModernMode = () => true;
