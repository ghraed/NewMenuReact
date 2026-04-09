import { cn } from '../utils/cn';

export const cx = (...classes: (string | boolean | undefined | null)[]) => cn(...classes);

export const primaryTone =
  '!bg-gold !text-bg0 !border-gold/70 enabled:hover:!bg-gold/95 enabled:hover:!border-gold enabled:hover:shadow-[0_14px_30px_rgba(212,175,55,0.18)]';
export const secondaryTone =
  'bg-sage/35 text-text border-sage/55 enabled:hover:bg-sage/42 enabled:hover:border-sage/70 enabled:hover:shadow-[0_14px_30px_rgba(0,0,0,0.26)]';
export const tertiaryTone =
  'bg-white/10 text-text border-white/20 enabled:hover:bg-white/14 enabled:hover:border-white/30 enabled:hover:shadow-[0_14px_30px_rgba(0,0,0,0.26)]';

export const glassSurface =
  'bg-bg1 border border-stroke shadow-lux';

export const glassControl =
  'bg-bg1 border border-stroke shadow-lux2';

export const glassSurfaceHover =
  'motion-safe:hover:border-white/18 motion-safe:hover:bg-bg1/95 motion-safe:hover:shadow-[0_26px_64px_rgba(0,0,0,0.44)]';

export const glassControlHover =
  'enabled:hover:border-white/24 enabled:hover:text-text enabled:hover:shadow-[0_14px_30px_rgba(0,0,0,0.28)]';

export const glassInteractive =
  'transition duration-300 ease-fluid motion-reduce:transition-none';

export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg1';

export const getModernMode = () => true;
