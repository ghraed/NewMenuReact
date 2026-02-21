import { cn } from '../utils/cn';

export const cx = (...classes: (string | boolean | undefined | null)[]) => cn(...classes);

export const primaryGradient = 'from-gold via-gold/90 to-gold2';
export const secondaryGradient = 'from-sage via-sage/85 to-gold2/80';
export const tertiaryGradient = 'from-white/16 via-white/8 to-white/14';

export const glassSurface =
  'bg-panel border border-stroke backdrop-blur-xl backdrop-saturate-150 shadow-lux';

export const glassControl =
  'bg-panel2 border border-stroke backdrop-blur-xl backdrop-saturate-150 shadow-lux2';

export const glassInteractive =
  'transition duration-300 ease-fluid motion-reduce:transition-none motion-safe:hover:-translate-y-0.5 motion-safe:hover:scale-[1.01] active:scale-[0.99]';

export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg1';

export const getModernMode = () => true;
