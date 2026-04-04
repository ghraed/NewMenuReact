import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export interface DishIngredientStoryItem {
  id: string | number;
  name: string;
  quantity?: string;
  imageUrl?: string | null;
}

type AnimationStage = 'idle' | 'expand' | 'float' | 'aligned' | 'labels';

interface DishIngredientStoryProps {
  dishName: string;
  dishImageUrl?: string | null;
  ingredients: DishIngredientStoryItem[];
}

const premiumEase: [number, number, number, number] = [0.22, 1, 0.36, 1];
const labelEase: [number, number, number, number] = [0.16, 1, 0.3, 1];

const getCenteredOffset = (index: number, total: number) => index - (total - 1) / 2;
const getFloatRotation = (index: number) => (index % 2 === 0 ? -1.7 : 1.7);

const DishIngredientStory: React.FC<DishIngredientStoryProps> = ({
  dishName,
  dishImageUrl,
  ingredients,
}) => {
  const [stage, setStage] = useState<AnimationStage>('idle');
  const timeoutsRef = useRef<number[]>([]);

  const clearScheduledStages = () => {
    timeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutsRef.current = [];
  };

  useEffect(() => () => clearScheduledStages(), []);

  const handleStartAnimation = () => {
    clearScheduledStages();
    setStage('idle');

    timeoutsRef.current.push(window.setTimeout(() => setStage('expand'), 80));
    timeoutsRef.current.push(window.setTimeout(() => setStage('float'), 980));
    timeoutsRef.current.push(window.setTimeout(() => setStage('aligned'), 2000));
    timeoutsRef.current.push(window.setTimeout(() => setStage('labels'), 2860));
  };

  const hasIngredients = ingredients.length > 0;
  const stageHeight = useMemo(() => Math.max(620, 280 + ingredients.length * 92), [ingredients.length]);
  const rowGap = 82;
  const rowStart = 54;
  const previewAnchorTop = Math.min(stageHeight - 190, Math.max(220, stageHeight * 0.48));

  return (
    <section
      className="overflow-hidden rounded-[36px] border"
      style={{
        backgroundColor: 'var(--guest-panel)',
        borderColor: 'var(--guest-border)',
        boxShadow: 'var(--guest-shadow)',
      }}
    >
      <div
        className="relative overflow-hidden px-4 py-5 sm:px-6 sm:py-6"
        style={{
          backgroundColor: 'var(--guest-panel-strong)',
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: [
              'radial-gradient(circle at 50% 6%, rgba(255,255,255,0.95), transparent 24%)',
              'linear-gradient(180deg, rgba(184,154,94,0.08) 0%, rgba(184,154,94,0.02) 52%, rgba(0,0,0,0) 100%)',
            ].join(', '),
          }}
        />

        <div className="relative mx-auto max-w-4xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--guest-accent)]">Ingredient Story</p>
              <h2 className="mt-2 font-serif text-3xl text-[var(--guest-text)] sm:text-4xl">{dishName}</h2>
              <p className="mt-2 text-sm leading-7 text-[var(--guest-muted)]">
                Start the animation to expand the plated dish into a clean vertical ingredient story inspired by editorial menu photography.
              </p>
            </div>

            <button
              type="button"
              onClick={handleStartAnimation}
              disabled={!hasIngredients}
              className="inline-flex items-center justify-center rounded-full border px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                backgroundColor: 'var(--guest-accent)',
                borderColor: 'var(--guest-accent)',
                color: 'var(--guest-panel)',
                boxShadow: 'var(--guest-shadow-soft)',
              }}
            >
              {stage === 'idle' ? 'Show Animation' : 'Replay Animation'}
            </button>
          </div>

          <div className="relative mx-auto max-w-[860px]" style={{ minHeight: `${stageHeight}px` }}>
            <div className="pointer-events-none absolute inset-x-[14%] top-0 h-24 rounded-full bg-white/40 blur-3xl" />

            <div className="absolute left-1/2 top-0 -translate-x-1/2">
              <motion.div
                animate={
                  stage === 'idle'
                    ? { y: previewAnchorTop - 70, scale: 1, opacity: 1, filter: 'blur(0px)' }
                    : stage === 'expand'
                      ? { y: previewAnchorTop - 36, scale: 0.9, opacity: 0.95, filter: 'blur(0.2px)' }
                      : stage === 'float'
                        ? { y: previewAnchorTop + 36, scale: 0.72, opacity: 0.66, filter: 'blur(0.8px)' }
                        : { y: stageHeight - 160, scale: 0.45, opacity: 0.16, filter: 'blur(1.4px)' }
                }
                transition={{ duration: 0.95, ease: premiumEase }}
                className="relative w-[220px] overflow-hidden rounded-[34px] border border-white/50 bg-white shadow-[0_24px_64px_rgba(113,84,37,0.18)] sm:w-[260px]"
              >
                {dishImageUrl ? (
                  <img src={dishImageUrl} alt={dishName} className="h-[220px] w-full object-cover sm:h-[260px]" />
                ) : (
                  <div className="flex h-[220px] items-center justify-center px-6 text-center text-sm font-semibold uppercase tracking-[0.24em] text-[var(--guest-muted)] sm:h-[260px]">
                    Dish Preview
                  </div>
                )}
              </motion.div>
            </div>

            {ingredients.map((ingredient, index) => {
              const rowTop = rowStart + index * rowGap;
              const centeredOffset = getCenteredOffset(index, ingredients.length);
              const startOffsetY = previewAnchorTop - rowTop - 10;
              const currentY =
                stage === 'idle'
                  ? startOffsetY
                  : stage === 'expand'
                    ? startOffsetY * 0.38
                    : stage === 'float'
                      ? centeredOffset * 12
                      : 0;

              const currentScale =
                stage === 'idle'
                  ? 0.52
                  : stage === 'expand'
                    ? 0.82
                    : stage === 'float'
                      ? 1.03
                      : 1;

              return (
                <div
                  key={ingredient.id}
                  className="pointer-events-none absolute inset-x-0"
                  style={{ top: `${rowTop}px` }}
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(140px,1.1fr)] items-center gap-4 sm:grid-cols-[minmax(0,0.9fr)_minmax(200px,1.1fr)] sm:gap-8">
                    <AnimatePresence>
                      {stage === 'labels' ? (
                        <motion.div
                          initial={{ opacity: 0, x: 26 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          transition={{ duration: 0.58, ease: labelEase, delay: index * 0.12 }}
                          className="flex items-center justify-end gap-2 sm:gap-3"
                        >
                          <div className="text-right">
                            <p className="text-sm font-semibold leading-5 text-[var(--guest-text)] sm:text-base">
                              {ingredient.name}
                            </p>
                            {ingredient.quantity ? (
                              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--guest-muted)]">
                                {ingredient.quantity}
                              </p>
                            ) : null}
                          </div>
                          <div
                            className="h-px w-7 rounded-full sm:w-10"
                            style={{ backgroundColor: 'var(--guest-accent)' }}
                          />
                          <span className="text-sm text-[var(--guest-accent)] sm:text-base">→</span>
                        </motion.div>
                      ) : (
                        <div />
                      )}
                    </AnimatePresence>

                    <div className="flex items-center justify-start sm:justify-center">
                      <motion.div
                        animate={{
                          y: currentY,
                          scale: currentScale,
                          opacity: stage === 'idle' ? 0 : 1,
                          rotateZ: stage === 'float' ? getFloatRotation(index) : 0,
                        }}
                        transition={{
                          duration: stage === 'expand' ? 0.92 : 1.02,
                          delay: index * 0.12,
                          ease: premiumEase,
                        }}
                        className="flex items-center justify-center py-1.5 sm:py-2.5"
                      >
                        {ingredient.imageUrl ? (
                          <img
                            src={ingredient.imageUrl}
                            alt={ingredient.name}
                            className="max-h-[78px] w-auto max-w-[190px] object-contain sm:max-h-[106px] sm:max-w-[290px]"
                            style={{
                              filter: 'drop-shadow(0 14px 18px rgba(111, 84, 43, 0.18))',
                            }}
                          />
                        ) : (
                          <div
                            className="flex min-h-[58px] min-w-[150px] items-center justify-center rounded-full border px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em]"
                            style={{
                              borderColor: 'var(--guest-border)',
                              color: 'var(--guest-muted)',
                              backgroundColor: 'rgba(255,255,255,0.45)',
                            }}
                          >
                            Ingredient
                          </div>
                        )}
                      </motion.div>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="absolute inset-x-0 bottom-0 flex justify-center">
              <div className="relative h-24 w-[min(90%,420px)]">
                <div
                  className="absolute inset-x-[10%] bottom-0 h-8 rounded-[50%]"
                  style={{
                    background: 'radial-gradient(circle at 50% 30%, rgba(0,0,0,0.08), rgba(0,0,0,0) 72%)',
                  }}
                />
                <div
                  className="absolute inset-x-0 bottom-4 h-16 rounded-[50%] border"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--guest-accent) 18%, var(--guest-panel) 82%)',
                    borderColor: 'color-mix(in srgb, var(--guest-accent) 56%, var(--guest-border) 44%)',
                    boxShadow: '0 18px 30px rgba(91,67,32,0.12)',
                  }}
                />
                <div
                  className="absolute inset-x-[8%] bottom-8 h-10 rounded-[50%] border"
                  style={{
                    backgroundColor: 'color-mix(in srgb, white 72%, var(--guest-accent) 28%)',
                    borderColor: 'rgba(255,255,255,0.6)',
                  }}
                />
              </div>
            </div>

            {!hasIngredients ? (
              <div
                className="absolute inset-x-4 bottom-28 rounded-[28px] border px-5 py-4 text-sm text-center sm:inset-x-16"
                style={{
                  backgroundColor: 'var(--guest-panel)',
                  borderColor: 'var(--guest-border)',
                  color: 'var(--guest-muted)',
                }}
              >
                No ingredient images are available for this dish yet. Add them from the admin dish editor to unlock the story page.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
};

export default DishIngredientStory;
