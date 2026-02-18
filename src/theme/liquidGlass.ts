import { cn } from '../utils/cn';

export const cx = (...classes: (string | boolean | undefined | null)[]) => cn(...classes);

export const primaryGradient = 'from-lg-primary/75 via-indigo-300/40 to-fuchsia-300/70';
export const secondaryGradient = 'from-lg-secondary/70 via-teal-200/35 to-cyan-300/70';
export const tertiaryGradient = 'from-white/25 via-white/10 to-white/25';

export const glassSurface = (modern: boolean) =>
  modern
    ? 'bg-white/[0.07] backdrop-blur-[34px] backdrop-saturate-150 border-white/35 shadow-[0_28px_88px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.56)] lg-noise'
    : 'bg-white/10 backdrop-blur-2xl border-white/20 shadow-[0_18px_54px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.48)] lg-noise';

export const glassControl = (modern: boolean) =>
  modern
    ? 'bg-white/[0.06] backdrop-blur-[24px] backdrop-saturate-150 border-white/30 shadow-[0_14px_40px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.5)] lg-noise lg-lift'
    : 'bg-white/10 backdrop-blur-2xl border-white/20 shadow-[0_10px_28px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.42)] lg-noise lg-lift';

export const glassSurfaceNoShadow = (modern: boolean) =>
  modern
    ? 'bg-white/[0.07] backdrop-blur-[34px] backdrop-saturate-150 border-white/35 lg-noise'
    : 'bg-white/10 backdrop-blur-2xl border-white/20 lg-noise';

export const glassControlNoShadow = (modern: boolean) =>
  modern
    ? 'bg-white/[0.06] backdrop-blur-[24px] backdrop-saturate-150 border-white/30 lg-noise'
    : 'bg-white/10 backdrop-blur-2xl border-white/20 lg-noise';

export const getModernMode = () =>
  typeof document !== 'undefined' && document.body.classList.contains('modern');
