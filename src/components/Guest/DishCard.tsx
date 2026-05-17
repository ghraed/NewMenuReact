import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Dish } from '../../types';
import { cx, focusRing } from '../../theme/liquidGlass';
import DishAssetThumbnail from '../Common/DishAssetThumbnail';
import DishTags from './DishTags';
import { getDishTags } from './guestPresentation';
import {
  convertPriceFromUsdToCurrency,
  formatPriceWithCurrency,
  formatUsdEquivalent,
  normalizeCurrency,
} from '../../utils/currency';

interface DishCardProps {
  dish: Dish;
  onOpen: () => void;
  onAddToCart?: () => void;
  onUpdateCartQuantity?: (quantity: number) => void;
  onShowRelatedOptions?: () => void;
  cartQuantity?: number;
  isIngredientAlert?: boolean;
}

const getPublicDishBadge = (
  dish: Dish,
  t: ReturnType<typeof useTranslation>['t']
): { label: string; tone: 'premium' | 'subtle' } | null => {
  const isAnchor = dish.is_anchor === true;
  const isProfitable = dish.is_profitable === true;

  if (isAnchor && isProfitable) {
    return {
      label: t('dishCard.badgeChefRecommendation'),
      tone: 'premium',
    };
  }

  if (isAnchor) {
    return {
      label: t('dishCard.badgeRecommended'),
      tone: 'premium',
    };
  }

  if (isProfitable) {
    return {
      label: t('dishCard.badgePopularChoice'),
      tone: 'subtle',
    };
  }

  return null;
};

const DishCard: React.FC<DishCardProps> = ({
  dish,
  onOpen,
  onAddToCart,
  onUpdateCartQuantity,
  onShowRelatedOptions,
  cartQuantity = 0,
  isIngredientAlert = false,
}) => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(
    () => typeof window === 'undefined' || !('IntersectionObserver' in window)
  );
  const [showDollarRate, setShowDollarRate] = useState(false);
  const articleRef = useRef<HTMLElement>(null);
  const tags = useMemo(() => getDishTags(dish), [dish]);
  const currency = normalizeCurrency(dish.currency);
  const originalCurrency = normalizeCurrency(dish.original_currency || dish.currency);
  const priceLabel = formatPriceWithCurrency(Number(dish.price), currency);
  const clickLabel = useMemo(() => {
    const amount = Number(dish.price);
    const hasRate = typeof dish.dollar_rate === 'number' && Number.isFinite(dish.dollar_rate) && dish.dollar_rate > 0;

    // If current price is USD but the configured original currency is not USD, show converted original amount on click.
    if (dish.price_is_usd_base === true && currency === 'USD' && originalCurrency !== 'USD' && hasRate) {
      const converted = convertPriceFromUsdToCurrency(amount, originalCurrency, dish.dollar_rate);
      return formatPriceWithCurrency(converted, originalCurrency);
    }

    return formatUsdEquivalent(amount, currency, dish.dollar_rate);
  }, [dish.price, dish.price_is_usd_base, dish.dollar_rate, currency, originalCurrency]);
  const caloriesText = typeof dish.calories === 'number' ? t('dishCard.calories', { count: dish.calories }) : null;
  const isOutOfStock = dish.is_orderable === false || dish.is_out_of_stock === true;
  const publicBadge = useMemo(() => getPublicDishBadge(dish, t), [dish, t]);

  useEffect(() => {
    const node = articleRef.current;

    if (!node) return;
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
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
        'group relative h-full w-full overflow-hidden rounded-[28px] border p-3 sm:p-4',
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
      <div className="relative z-10 grid h-full grid-rows-[auto_1fr]">
        <DishAssetThumbnail
          dish={dish}
          fit="cover"
          className="aspect-[4/3] w-full sm:h-[240px] sm:aspect-auto"
          imageClassName="transition duration-500 ease-fluid"
          overlayClassName="bg-black/5"
        />

        <div className="min-w-0 px-1 pb-1 pt-4 grid h-full grid-rows-[auto_1fr_auto] sm:grid-rows-[2.25rem_5rem_7.25rem_3rem_1.5rem_3.5rem] sm:gap-y-3">
          <div className="min-h-[2.25rem] sm:min-h-0">
            {isIngredientAlert ? (
              <div
                className="mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
                style={{
                  backgroundColor: 'color-mix(in srgb, rgb(var(--color-spicy)) 16%, transparent)',
                  borderColor: 'color-mix(in srgb, rgb(var(--color-spicy)) 44%, var(--guest-border))',
                  color: 'rgb(var(--color-spicy))',
                }}
              >
                {t('dishCard.ingredientWarning')}
              </div>
            ) : null}

            {isOutOfStock ? (
              <div
                className="mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
                style={{
                  backgroundColor: 'color-mix(in srgb, rgb(var(--color-spicy)) 16%, transparent)',
                  borderColor: 'color-mix(in srgb, rgb(var(--color-spicy)) 44%, var(--guest-border))',
                  color: 'rgb(var(--color-spicy))',
                }}
              >
                {t('dishCard.outOfStock')}
              </div>
            ) : null}

            {publicBadge ? (
              <div
                className="mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
                style={publicBadge.tone === 'premium'
                  ? {
                    backgroundColor: 'color-mix(in srgb, rgb(var(--color-gold)) 20%, transparent)',
                    borderColor: 'color-mix(in srgb, rgb(var(--color-gold)) 52%, var(--guest-border))',
                    color: 'rgb(var(--color-gold2))',
                  }
                  : {
                    backgroundColor: 'var(--guest-accent-soft)',
                    borderColor: 'var(--guest-border)',
                    color: 'var(--guest-accent)',
                  }}
              >
                {publicBadge.label}
              </div>
            ) : null}
          </div>

          <div className="min-h-0 sm:contents">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-5">
              <h3 className="min-w-0 overflow-hidden text-ellipsis font-serif text-2xl leading-tight text-[var(--guest-text)] sm:line-clamp-2 sm:text-[1.75rem]">
                {dish.name}
              </h3>

              <div className="min-w-[86px] pt-1 text-right">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowDollarRate((current) => !current);
                  }}
                  className="text-xs font-medium tracking-[0.06em] text-[var(--guest-muted)] transition hover:text-[var(--guest-text)]"
                  aria-label="Show USD equivalent"
                >
                  {priceLabel}
                </button>
                {showDollarRate ? (
                  <p className="mt-1 text-[10px] font-medium leading-4 text-[var(--guest-muted)]">
                    {clickLabel}
                  </p>
                ) : null}
              </div>
            </div>

            <p className="mt-3 pr-1 text-sm leading-7 text-[var(--guest-muted)] line-clamp-3 sm:mt-0 sm:line-clamp-3">
              {dish.description}
            </p>

            <DishTags tags={tags} scrollable={false} className="mt-4 sm:mt-0 sm:w-full" />
          </div>

          <div className="mt-5 space-y-4 sm:mt-0 sm:space-y-0 sm:contents">
            <div className="min-h-5 text-sm sm:min-h-0">
              {caloriesText ? (
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--guest-muted)]">{caloriesText}</p>
              ) : null}
            </div>

            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
              {isOutOfStock && onShowRelatedOptions ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onShowRelatedOptions();
                  }}
                  className={cx(
                    'w-full whitespace-nowrap rounded-full border px-4 py-3 text-sm font-semibold sm:min-h-[50px] sm:px-0',
                    'transition duration-300 ease-fluid motion-reduce:transition-none',
                    'hover:shadow-[0_12px_28px_rgba(0,0,0,0.16)]',
                    focusRing
                  )}
                  style={{
                    backgroundColor: 'var(--guest-accent-soft)',
                    borderColor: 'var(--guest-accent)',
                    color: 'var(--guest-accent)',
                  }}
                >
                  {t('dishCard.orderRelated', { defaultValue: 'Try Similar Favorites' })}
                </button>
              ) : onAddToCart ? (
                cartQuantity > 0 ? (
                  <div
                    className="grid w-full grid-cols-[auto_1fr_auto] items-center rounded-full border sm:min-h-[50px]"
                    style={{
                      backgroundColor: 'var(--guest-accent-soft)',
                      borderColor: 'var(--guest-border)',
                      color: 'var(--guest-accent)',
                    }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => onUpdateCartQuantity?.(Math.max(0, cartQuantity - 1))}
                      className={cx(
                        'inline-flex h-full min-h-[50px] items-center justify-center rounded-l-full px-4 text-lg font-semibold',
                        'transition duration-300 ease-fluid motion-reduce:transition-none',
                        'hover:shadow-[0_12px_28px_rgba(0,0,0,0.16)]',
                        focusRing
                      )}
                      aria-label="Decrease quantity"
                    >
                      -
                    </button>

                    <input
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      value={cartQuantity}
                      onChange={(event) => {
                        const raw = event.target.value.trim();
                        if (raw === '') {
                          return;
                        }
                        const next = Number.parseInt(raw, 10);
                        if (!Number.isFinite(next) || next < 0) {
                          return;
                        }
                        onUpdateCartQuantity?.(next);
                      }}
                      onClick={(event) => event.stopPropagation()}
                      className="w-full bg-transparent px-1 text-center text-sm font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      aria-label="Quantity"
                    />

                    <button
                      type="button"
                      onClick={() => onAddToCart()}
                      className={cx(
                        'inline-flex h-full min-h-[50px] items-center justify-center rounded-r-full px-4 text-lg font-semibold',
                        'transition duration-300 ease-fluid motion-reduce:transition-none',
                        'hover:shadow-[0_12px_28px_rgba(0,0,0,0.16)]',
                        focusRing
                      )}
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onAddToCart();
                    }}
                    className={cx(
                      'w-full whitespace-nowrap rounded-full border px-4 py-3 text-sm font-semibold sm:min-h-[50px]',
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
                    {t('dishCard.addToCart')}
                  </button>
                )
              ) : null}

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpen();
                }}
                className={cx(
                  'w-full whitespace-nowrap rounded-full border px-4 py-3 text-sm font-semibold sm:min-h-[50px]',
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
                {t('dishCard.viewDetails')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};

export default DishCard;
