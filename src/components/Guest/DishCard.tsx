import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Dish } from '../../types';
import { cx, focusRing } from '../../theme/liquidGlass';
import DishAssetThumbnail from '../Common/DishAssetThumbnail';
import DishTags from './DishTags';
import { getDishIngredientsText, getDishTags } from './guestPresentation';

interface DishCardProps {
  dish: Dish;
  onOpen: () => void;
  onAddToCart?: () => void;
  cartQuantity?: number;
  isIngredientAlert?: boolean;
}

const DishCard: React.FC<DishCardProps> = ({
  dish,
  onOpen,
  onAddToCart,
  cartQuantity = 0,
  isIngredientAlert = false,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const articleRef = useRef<HTMLElement>(null);
  const tags = useMemo(() => getDishTags(dish), [dish]);
  const ingredientsText = useMemo(() => {
    const ingredientLabels = dish.assets
      .filter((asset) => asset.asset_type === 'ingredient_image')
      .sort((left, right) => {
        const leftOrder = typeof left.metadata?.order_index === 'number' ? left.metadata.order_index : 0;
        const rightOrder = typeof right.metadata?.order_index === 'number' ? right.metadata.order_index : 0;
        return leftOrder - rightOrder;
      })
      .map((asset) => {
        const label = asset.metadata?.label;
        return typeof label === 'string' && label.trim() ? label.trim() : null;
      })
      .filter((label): label is string => Boolean(label));

    if (ingredientLabels.length > 0) {
      return ingredientLabels.join(', ');
    }

    return getDishIngredientsText(dish);
  }, [dish]);

  const price = Number(dish.price).toFixed(2);
  const caloriesText = typeof dish.calories === 'number' ? `${dish.calories} kcal` : null;

  useEffect(() => {
    const node = articleRef.current;

    if (!node) return;
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.16,
        rootMargin: '0px 0px -8% 0px',
      }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <article
      ref={articleRef}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      className={cx(
        'group relative w-full overflow-hidden rounded-[28px] border p-3 sm:p-4',
        'transition duration-700 ease-fluid motion-reduce:transform-none motion-reduce:opacity-100',
        'hover:ring-1 hover:ring-white/10',
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
        focusRing,
        'cursor-pointer'
      )}
      style={{
        backgroundColor: isIngredientAlert ? 'color-mix(in srgb, rgb(var(--color-spicy)) 10%, var(--guest-panel))' : 'var(--guest-panel)',
        borderColor: isIngredientAlert ? 'color-mix(in srgb, rgb(var(--color-spicy)) 56%, var(--guest-border))' : 'var(--guest-border)',
        boxShadow: isIngredientAlert ? '0 22px 52px rgba(214, 99, 89, 0.18)' : 'var(--guest-shadow-soft)',
      }}
    >
      <div className="relative z-10">
        <DishAssetThumbnail
          dish={dish}
          fit="cover"
          className="aspect-[4/3] w-full"
          imageClassName="transition duration-500 ease-fluid"
          overlayClassName="bg-black/5"
        />

        <div className="min-w-0 px-1 pb-1 pt-4">
          {isIngredientAlert ? (
            <div
              className="mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
              style={{
                backgroundColor: 'color-mix(in srgb, rgb(var(--color-spicy)) 16%, transparent)',
                borderColor: 'color-mix(in srgb, rgb(var(--color-spicy)) 44%, var(--guest-border))',
                color: 'rgb(var(--color-spicy))',
              }}
            >
              Ingredient Warning
            </div>
          ) : null}

          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 font-serif text-2xl leading-tight text-[var(--guest-text)] sm:text-[1.75rem]">{dish.name}</h3>
            <span
              className="shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold"
              style={{
                backgroundColor: 'var(--guest-accent-soft)',
                borderColor: 'var(--guest-border)',
                color: 'var(--guest-accent)',
              }}
            >
              ${price}
            </span>
          </div>

          <p className="mt-3 line-clamp-3 text-sm leading-7 text-[var(--guest-muted)]">{dish.description}</p>

          <DishTags tags={tags} className="mt-4" />

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-h-5 text-sm sm:max-w-[65%]">
              <span className="line-clamp-2 font-medium text-[var(--guest-accent)]">{ingredientsText}</span>
              {caloriesText ? (
                <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-[var(--guest-muted)]">
                  {caloriesText}
                </p>
              ) : null}
            </div>

            <div className="flex w-full gap-2 sm:w-auto">
              {onAddToCart ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onAddToCart();
                  }}
                  className={cx(
                    'w-full rounded-full border px-4 py-3 text-sm font-semibold sm:min-w-[140px]',
                    'transition duration-300 ease-fluid motion-reduce:transition-none',
                    'hover:shadow-[0_12px_28px_rgba(0,0,0,0.16)]',
                    focusRing
                  )}
                  style={{
                    backgroundColor: 'var(--guest-accent-soft)',
                    borderColor: 'var(--guest-border)',
                    color: 'var(--guest-accent)',
                  }}
                >
                  {cartQuantity > 0 ? `Add More (${cartQuantity})` : 'Add to Cart'}
                </button>
              ) : null}

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpen();
                }}
                className={cx(
                  'w-full rounded-full border px-4 py-3 text-sm font-semibold sm:w-auto sm:min-w-[160px]',
                  'transition duration-300 ease-fluid motion-reduce:transition-none',
                  'hover:shadow-[0_12px_28px_rgba(0,0,0,0.16)]',
                  focusRing
                )}
                style={{
                  backgroundColor: 'var(--guest-text)',
                  borderColor: 'var(--guest-text)',
                  color: 'var(--guest-bg)',
                }}
              >
                View Details
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};

export default DishCard;
