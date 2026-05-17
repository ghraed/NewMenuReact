import React, { useCallback, useEffect, useRef, useState } from 'react';

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const PageScrollProgress: React.FC = () => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [canScroll, setCanScroll] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const progressRailRef = useRef<HTMLDivElement | null>(null);

  const getScrollMax = () => {
    const doc = document.documentElement;
    return Math.max(0, doc.scrollHeight - window.innerHeight);
  };

  const syncScrollState = useCallback(() => {
    const maxScroll = getScrollMax();
    setCanScroll(maxScroll > 12);
    if (maxScroll <= 0) {
      setScrollProgress(0);
      return;
    }
    setScrollProgress(clamp(window.scrollY / maxScroll, 0, 1));
  }, []);

  const scrollPageToProgress = useCallback((nextProgress: number) => {
    const maxScroll = getScrollMax();
    const bounded = clamp(nextProgress, 0, 1);
    window.scrollTo({ top: bounded * maxScroll, behavior: 'auto' });
    setScrollProgress(bounded);
  }, []);

  const computeProgressFromPointer = useCallback((clientX: number) => {
    const rail = progressRailRef.current;
    if (!rail) return 0;
    const rect = rail.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return clamp((clientX - rect.left) / rect.width, 0, 1);
  }, []);

  useEffect(() => {
    syncScrollState();
    window.addEventListener('scroll', syncScrollState, { passive: true });
    window.addEventListener('resize', syncScrollState);
    return () => {
      window.removeEventListener('scroll', syncScrollState);
      window.removeEventListener('resize', syncScrollState);
    };
  }, [syncScrollState]);

  useEffect(() => {
    if (!isScrubbing) return;

    const handleMove = (event: PointerEvent) => {
      const nextProgress = computeProgressFromPointer(event.clientX);
      scrollPageToProgress(nextProgress);
    };

    const stopScrub = () => setIsScrubbing(false);

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', stopScrub);
    window.addEventListener('pointercancel', stopScrub);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', stopScrub);
      window.removeEventListener('pointercancel', stopScrub);
    };
  }, [isScrubbing, computeProgressFromPointer, scrollPageToProgress]);

  if (!canScroll) return null;

  return (
    <div className="sticky top-[74px] z-20 mb-3 mt-1">
      <div className="rounded-xl border border-stroke/60 bg-bg1/56 px-3 py-2 backdrop-blur">
        <div
          ref={progressRailRef}
          role="slider"
          aria-label="Page scroll progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(scrollProgress * 100)}
          tabIndex={0}
          className="group relative h-3 w-full cursor-ew-resize rounded-full border border-stroke/40 bg-bg1/14"
          onPointerDown={(event) => {
            const nextProgress = computeProgressFromPointer(event.clientX);
            scrollPageToProgress(nextProgress);
            setIsScrubbing(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
              event.preventDefault();
              scrollPageToProgress(scrollProgress + 0.03);
            }
            if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
              event.preventDefault();
              scrollPageToProgress(scrollProgress - 0.03);
            }
            if (event.key === 'Home') {
              event.preventDefault();
              scrollPageToProgress(0);
            }
            if (event.key === 'End') {
              event.preventDefault();
              scrollPageToProgress(1);
            }
          }}
        >
          <div className="absolute inset-y-0 left-0 rounded-full bg-gold/70 transition-[width] duration-150 ease-out" style={{ width: `${scrollProgress * 100}%` }} />
          <div className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border border-gold/60 bg-bg1 shadow-lux2 transition-[left] duration-150 ease-out" style={{ left: `calc(${scrollProgress * 100}% - 0.5rem)` }} />
        </div>

        <div className="mt-2 flex items-center justify-between text-[10px] font-semibold tracking-[0.08em] text-gold2/50">
          {[
            { progress: 0.25, label: '1/4' },
            { progress: 0.5, label: '1/2' },
            { progress: 0.75, label: '3/4' },
            { progress: 1, label: '⇣|' },
          ].map((mark) => (
            <button
              key={mark.label}
              type="button"
              onClick={() => scrollPageToProgress(mark.progress)}
              className={[
                'inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-2 transition',
                scrollProgress >= mark.progress ? 'border-gold/45 bg-gold/8 text-gold2/85' : 'border-stroke/45 text-muted2/70 hover:border-gold/20 hover:text-gold2/75',
              ].join(' ')}
            >
              {mark.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PageScrollProgress;
