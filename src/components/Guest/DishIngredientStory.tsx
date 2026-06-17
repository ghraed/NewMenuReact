import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { getIngredientDisplayName } from '../../utils/ingredientDisplay';

export interface DishIngredientStoryItem {
  id: string | number;
  name: string;
  nameAr?: string | null;
  quantity?: string;
  imageUrl?: string | null;
}

type AnimationStage = 'idle' | 'reset' | 'lift' | 'travel' | 'labels';

interface DishIngredientStoryProps {
  dishName: string;
  dishImageUrl?: string | null;
  ingredients: DishIngredientStoryItem[];
}

const premiumEase: [number, number, number, number] = [0.22, 1, 0.36, 1];
const labelEase: [number, number, number, number] = [0.16, 1, 0.3, 1];

const getCenteredOffset = (index: number, total: number) => index - (total - 1) / 2;
const getFloatRotation = (index: number) => (index % 2 === 0 ? -1.7 : 1.7);

const getHorizontalTravel = () => {
  if (typeof window === 'undefined') {
    return -160;
  }

  if (window.innerWidth < 640) {
    return -64;
  }

  if (window.innerWidth < 1024) {
    return -118;
  }

  return -180;
};

const DishIngredientStory: React.FC<DishIngredientStoryProps> = ({
  dishName,
  dishImageUrl,
  ingredients,
}) => {
  const { t, i18n } = useTranslation();
  const [stage, setStage] = useState<AnimationStage>('idle');
  const timeoutsRef = useRef<number[]>([]);

  const clearScheduledStages = () => {
    timeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutsRef.current = [];
  };

  useEffect(() => () => clearScheduledStages(), []);

  const handleStartAnimation = () => {
    clearScheduledStages();
    setStage('reset');

    timeoutsRef.current.push(window.setTimeout(() => setStage('lift'), 140));
    timeoutsRef.current.push(window.setTimeout(() => setStage('travel'), 1240));
    timeoutsRef.current.push(window.setTimeout(() => setStage('labels'), 2500));
  };

  const hasIngredients = ingredients.length > 0;
  const previewAnchorTop = 44;
  const previewBandHeight = 292;
  const rowGap = 82;
  const rowStart = previewBandHeight + 12;
  const stageHeight = useMemo(
    () => Math.max(620, rowStart + Math.max(ingredients.length - 1, 0) * rowGap + 120),
    [ingredients.length]
  );
  const dishCenterTop = previewAnchorTop + 116;
  const centerLiftTop = previewAnchorTop + 88;
  const horizontalTravel = useMemo(() => getHorizontalTravel(), []);

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
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--guest-accent)]">{t('ingredientStory.eyebrow')}</p>
              <h2 className="mt-2 font-serif text-3xl text-[var(--guest-text)] sm:text-4xl">{dishName}</h2>
              <p className="mt-2 text-sm leading-7 text-[var(--guest-muted)]">
                {t('ingredientStory.animationHint')}
              </p>
            </div>

            <button
              type="button"
              onClick={handleStartAnimation}
              disabled={!hasIngredients}
              className="inline-flex w-full sm:w-auto items-center justify-center rounded-full border px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                backgroundColor: 'var(--guest-accent)',
                borderColor: 'var(--guest-accent)',
                color: 'var(--guest-accent-button-text)',
                boxShadow: 'var(--guest-shadow-soft)',
                
              }}
            >
              {stage === 'idle' ? t('ingredientStory.showAnimation') : t('ingredientStory.replayAnimation')}
            </button>
          </div>

          <div className="relative mx-auto max-w-[860px]" style={{ minHeight: `${stageHeight}px` }}>
            <div className="pointer-events-none absolute inset-x-[14%] top-0 h-24 rounded-full bg-white/40 blur-3xl" />

            <div className="absolute left-1/2 top-0 -translate-x-1/2">
              <motion.div
                animate={
                  stage === 'idle' || stage === 'reset'
                    ? { y: previewAnchorTop, scale: 1, opacity: 1, filter: 'blur(0px)' }
                    : stage === 'lift'
                      ? { y: previewAnchorTop + 2, scale: 0.98, opacity: 1, filter: 'blur(0px)' }
                      : stage === 'travel'
                        ? { y: previewAnchorTop + 2, scale: 0.98, opacity: 1, filter: 'blur(0px)' }
                        : { y: previewAnchorTop, scale: 1, opacity: 1, filter: 'blur(0px)' }
                }
                transition={{ duration: stage === 'reset' ? 0 : 0.9, ease: premiumEase }}
                className="relative w-[220px] overflow-hidden rounded-[34px] border border-white/50 bg-white shadow-[0_24px_64px_rgba(113,84,37,0.18)] sm:w-[260px]"
              >
                {dishImageUrl ? (
                  <img src={dishImageUrl} alt={dishName} className="h-[220px] w-full object-cover sm:h-[260px]" />
                ) : (
                  <div className="flex h-[220px] items-center justify-center px-6 text-center text-sm font-semibold uppercase tracking-[0.24em] text-[var(--guest-muted)] sm:h-[260px]">
                    {t('ingredientStory.dishPreview')}
                  </div>
                )}
              </motion.div>
            </div>

            {ingredients.map((ingredient, index) => {
              const rowTop = rowStart + index * rowGap;
              const centeredOffset = getCenteredOffset(index, ingredients.length);
              const startFromDishY = dishCenterTop - rowTop + centeredOffset * 4;
              const liftToCenterY = centerLiftTop - rowTop + centeredOffset * 10;
              const isHiddenStage = stage === 'idle' || stage === 'reset';

              const currentY =
                isHiddenStage
                  ? startFromDishY
                  : stage === 'lift'
                    ? liftToCenterY
                    : stage === 'travel'
                      ? 0
                    : 0;

              const currentX =
                isHiddenStage
                  ? horizontalTravel
                  : stage === 'lift'
                    ? horizontalTravel
                    : stage === 'travel'
                      ? 0
                    : 0;

              const currentScale =
                isHiddenStage
                  ? 0.56
                  : stage === 'lift'
                    ? 0.84
                    : stage === 'travel'
                      ? 1
                    : 1;

              return (
                <div
                  key={ingredient.id}
                  className="absolute inset-x-0"
                  style={{ top: `${rowTop}px` }}
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(140px,1.1fr)] items-center gap-4 sm:grid-cols-[minmax(0,0.9fr)_minmax(200px,1.1fr)] sm:gap-8">
                    <AnimatePresence>
                      {stage === 'labels' ? (
                        <motion.div
                          initial={{ opacity: 0, x: 26 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10, transition: { duration: 0.12 } }}
                          transition={{ duration: 0.58, ease: labelEase, delay: index * 0.12 }}
                          className="flex items-center justify-end gap-2 sm:gap-3"
                        >
                          <div className="text-right">
                            <p className="text-sm font-semibold leading-5 text-[var(--guest-text)] sm:text-base">
                              {getIngredientDisplayName({ name: ingredient.name, name_ar: ingredient.nameAr }, i18n.resolvedLanguage)}
                            </p>
                            {ingredient.quantity ? (
                              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--guest-muted)]">
                                {ingredient.quantity}
                              </p>
                            ) : null}
                          </div>
                          <span className="text-sm text-[var(--guest-accent)] sm:text-base">→</span>
                        </motion.div>
                      ) : (
                        <div />
                      )}
                    </AnimatePresence>

                    <div className="flex items-center justify-start sm:justify-center">
                      <motion.div
                        animate={{
                          x: currentX,
                          y: currentY,
                          scale: currentScale,
                          opacity: isHiddenStage ? 0 : 1,
                          rotateZ: stage === 'lift' ? getFloatRotation(index) * 0.4 : 0,
                        }}
                        transition={{
                          duration:
                            stage === 'reset'
                              ? 0
                              : stage === 'lift'
                                ? 0.96
                                : 1.12,
                          delay: stage === 'reset' ? 0 : index * 0.12,
                          ease: premiumEase,
                        }}
                        className="flex items-center justify-center py-2.5 sm:py-3.5"
                      >
                        {ingredient.imageUrl ? (
                          <img
                            src={ingredient.imageUrl}
                            alt={getIngredientDisplayName({ name: ingredient.name, name_ar: ingredient.nameAr }, i18n.resolvedLanguage)}
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
                            {t('ingredientStory.ingredient')}
                          </div>
                        )}
                      </motion.div>
                    </div>
                  </div>
                </div>
              );
            })}

            {!hasIngredients ? (
              <div
                className="absolute inset-x-4 bottom-12 rounded-[28px] border px-5 py-4 text-sm text-center sm:inset-x-16"
                style={{
                  backgroundColor: 'var(--guest-panel)',
                  borderColor: 'var(--guest-border)',
                  color: 'var(--guest-muted)',
                }}
              >
                {t('ingredientStory.empty')}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
};

export default DishIngredientStory;
