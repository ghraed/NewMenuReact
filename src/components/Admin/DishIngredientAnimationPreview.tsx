import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LiquidButton } from '../ui/liquid-glass';

type AnimationStage = 'idle' | 'expand' | 'float' | 'aligned' | 'labels';

export interface DishIngredientAnimationItem {
  id: string | number;
  name: string;
  quantity?: string;
  imageUrl?: string | null;
}

interface DishIngredientAnimationPreviewProps {
  dishName: string;
  dishImageUrl?: string | null;
  ingredients: DishIngredientAnimationItem[];
}

const premiumEase: [number, number, number, number] = [0.22, 1, 0.36, 1];
const labelEase: [number, number, number, number] = [0.16, 1, 0.3, 1];

const getCenteredOffset = (index: number, total: number) => index - (total - 1) / 2;
const getExpandOffset = (index: number, total: number) => getCenteredOffset(index, total) * 26;
const getFloatOffset = (index: number, total: number) => getCenteredOffset(index, total) * 54;
const getAlignedOffset = (index: number, total: number) => getCenteredOffset(index, total) * 88;

const getRotation = (index: number) => {
  const direction = index % 2 === 0 ? -1 : 1;
  return {
    rotateZ: direction * 2.6,
    rotateX: direction * 5,
    rotateY: direction * -7,
  };
};

const DishIngredientAnimationPreview: React.FC<DishIngredientAnimationPreviewProps> = ({
  dishName,
  dishImageUrl,
  ingredients,
}) => {
  const [stage, setStage] = useState<AnimationStage>('idle');
  const timeoutsRef = useRef<number[]>([]);

  const clearScheduledStages = () => {
    timeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
    timeoutsRef.current = [];
  };

  useEffect(() => () => clearScheduledStages(), []);

  const handleStartAnimation = () => {
    clearScheduledStages();
    setStage('idle');

    timeoutsRef.current.push(window.setTimeout(() => setStage('expand'), 80));
    timeoutsRef.current.push(window.setTimeout(() => setStage('float'), 1020));
    timeoutsRef.current.push(window.setTimeout(() => setStage('aligned'), 2180));
    timeoutsRef.current.push(window.setTimeout(() => setStage('labels'), 3320));
  };

  const hasIngredients = ingredients.length > 0;
  const centeredImageLabel = dishName.trim() || 'Dish preview';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-text">Ingredient Animation Preview</h3>
          <p className="mt-1 text-sm text-muted">
            Start the sequence to preview the dish expansion, floating layers, clean stack, and staggered labels.
          </p>
        </div>
        <LiquidButton
          type="button"
          tone="primary"
          onClick={handleStartAnimation}
          disabled={!hasIngredients}
        >
          Start Animation
        </LiquidButton>
      </div>

      <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(237,175,92,0.24),_transparent_35%),linear-gradient(180deg,_rgba(18,25,38,0.98),_rgba(8,13,23,0.96))] p-5 sm:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.06),transparent)] opacity-70" />
        <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
          <div
            className="relative min-h-[520px] rounded-[26px] border border-white/8 bg-white/[0.025] p-4"
            style={{ perspective: 1200 }}
          >
            <div className="pointer-events-none absolute inset-x-8 bottom-8 h-24 rounded-full bg-[#f0b47c]/20 blur-3xl" />

            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                animate={
                  stage === 'idle'
                    ? { scale: 1, opacity: 1, y: 0, filter: 'blur(0px)' }
                    : stage === 'expand'
                      ? { scale: 0.94, opacity: 0.92, y: 4, filter: 'blur(0.6px)' }
                      : stage === 'float'
                        ? { scale: 0.84, opacity: 0.72, y: 12, filter: 'blur(1px)' }
                        : { scale: 0.72, opacity: 0.28, y: 20, filter: 'blur(1.4px)' }
                }
                transition={{ duration: 0.9, ease: premiumEase }}
                className="relative h-56 w-56 overflow-hidden rounded-full border border-white/15 bg-[#101827] shadow-[0_28px_80px_rgba(0,0,0,0.45)] sm:h-64 sm:w-64"
              >
                {dishImageUrl ? (
                  <img
                    src={dishImageUrl}
                    alt={centeredImageLabel}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.12),transparent_40%),linear-gradient(180deg,rgba(247,200,122,0.25),rgba(19,27,43,0.92))] px-8 text-center text-sm font-semibold uppercase tracking-[0.24em] text-white/80">
                    Dish Preview
                  </div>
                )}
                <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/10" />
              </motion.div>
            </div>

            {ingredients.map((ingredient, index) => {
              const centeredOffset = getCenteredOffset(index, ingredients.length);
              const floatingRotation = getRotation(index);
              const y =
                stage === 'idle'
                  ? 0
                  : stage === 'expand'
                    ? getExpandOffset(index, ingredients.length)
                    : stage === 'float'
                      ? getFloatOffset(index, ingredients.length)
                      : getAlignedOffset(index, ingredients.length);

              const rotateValues =
                stage === 'float'
                  ? floatingRotation
                  : { rotateX: 0, rotateY: 0, rotateZ: 0 };

              const shadowStrength =
                stage === 'idle'
                  ? '0 10px 24px rgba(0, 0, 0, 0.08)'
                  : stage === 'expand'
                    ? '0 16px 34px rgba(0, 0, 0, 0.2)'
                    : stage === 'float'
                      ? '0 22px 48px rgba(0, 0, 0, 0.28)'
                      : '0 18px 40px rgba(0, 0, 0, 0.24)';

              return (
                <div key={ingredient.id} className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <motion.div
                    animate={{
                      y,
                      scale: stage === 'idle' ? 0.74 : stage === 'expand' ? 0.9 : 1,
                      opacity: stage === 'idle' ? 0 : 1,
                      boxShadow: shadowStrength,
                      ...rotateValues,
                    }}
                    transition={{
                      duration: stage === 'expand' ? 0.9 : 1.05,
                      delay: index * 0.12,
                      ease: premiumEase,
                    }}
                    className="relative h-24 w-40 overflow-hidden rounded-[24px] border border-white/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.07))] backdrop-blur-md sm:h-28 sm:w-48"
                  >
                    {ingredient.imageUrl ? (
                      <img
                        src={ingredient.imageUrl}
                        alt={ingredient.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center px-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                        Ingredient
                      </div>
                    )}
                    <div
                      className="pointer-events-none absolute inset-x-6 bottom-2 h-4 rounded-full bg-black/35 blur-xl"
                      style={{ opacity: Math.min(0.55, 0.18 + Math.abs(centeredOffset) * 0.08) }}
                    />
                  </motion.div>
                </div>
              );
            })}

            <AnimatePresence>
              {stage === 'labels' &&
                ingredients.map((ingredient, index) => (
                  <div
                    key={`label-${ingredient.id}`}
                    className="pointer-events-none absolute left-1/2 top-1/2 ml-24 sm:ml-36"
                  >
                    <motion.div
                      initial={{ opacity: 0, x: 26, y: getAlignedOffset(index, ingredients.length) }}
                      animate={{ opacity: 1, x: 0, y: getAlignedOffset(index, ingredients.length) }}
                      exit={{ opacity: 0, x: 12, transition: { duration: 0.18 } }}
                      transition={{
                        duration: 0.58,
                        ease: labelEase,
                        delay: index * 0.14,
                      }}
                      className="w-32 rounded-2xl border border-white/12 bg-slate-950/70 px-3 py-2 shadow-[0_14px_28px_rgba(0,0,0,0.25)] backdrop-blur-md sm:w-44"
                    >
                      <p className="text-sm font-semibold text-white">{ingredient.name}</p>
                      {ingredient.quantity ? (
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/55">{ingredient.quantity}</p>
                      ) : null}
                    </motion.div>
                  </div>
                ))}
            </AnimatePresence>

            {!hasIngredients ? (
              <div className="absolute inset-x-6 bottom-6 rounded-2xl border border-gold/20 bg-gold/10 px-4 py-3 text-sm text-gold2">
                Add ingredient images below to see the layered animation sequence.
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">Stage Flow</p>
              <div className="mt-3 space-y-2 text-sm text-white/78">
                <div className={stage === 'idle' ? 'text-gold2' : undefined}>1. Compact dish hero</div>
                <div className={stage === 'expand' ? 'text-gold2' : undefined}>2. Smooth ingredient lift</div>
                <div className={stage === 'float' ? 'text-gold2' : undefined}>3. Minimal premium tilt</div>
                <div className={stage === 'aligned' ? 'text-gold2' : undefined}>4. Structured vertical stack</div>
                <div className={stage === 'labels' ? 'text-gold2' : undefined}>5. Staggered labels</div>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">Live Inputs</p>
              <p className="mt-3 text-sm text-white/75">
                Center image: {dishImageUrl ? 'Preview image ready' : 'Waiting for preview image'}
              </p>
              <p className="mt-2 text-sm text-white/75">
                Ingredient layers: {ingredients.length}
              </p>
              <p className="mt-2 text-sm text-white/55">
                Labels fade and slide in only after the stack settles, keeping the final state readable.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DishIngredientAnimationPreview;
