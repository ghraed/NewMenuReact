import { cn } from '../utils/cn';

export const cx = (...classes: (string | boolean | undefined | null)[]) => cn(...classes);

export const primaryGradient = 'from-lg-primary/75 via-indigo-300/40 to-fuchsia-300/70';
export const secondaryGradient = 'from-lg-secondary/70 via-teal-200/35 to-cyan-300/70';
export const tertiaryGradient = 'from-white/25 via-white/10 to-white/25';

export const glassSurface = (modern: boolean) =>
  modern
    ? 'bg-white/[0.07] backdrop-saturate-150 border-white/35 shadow-none lg-noise'
    : 'bg-white/10 backdrop-blur-2xl border-white/20 shadow-none lg-noise';

export const glassControl = (modern: boolean) =>
  modern
    ? 'bg-white/[0.06] backdrop-blur-[24px] backdrop-saturate-150 border-white/30 shadow-none lg-noise lg-lift'
    : 'bg-white/10 backdrop-blur-2xl border-white/20 shadow-none lg-noise lg-lift';

export const getModernMode = () =>
  typeof document !== 'undefined' && document.body.classList.contains('modern');
