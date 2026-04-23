import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Dish } from '../../types';
import { cx, focusRing } from '../../theme/liquidGlass';
import DishAssetThumbnail from '../Common/DishAssetThumbnail';
import DishTags from './DishTags';
import { getDishTags } from './guestPresentation';
import { formatDollarRate, formatPriceWithCurrency, normalizeCurrency } from '../../utils/currency';

interface DishCardProps {
  dish: Dish;
  onOpen: () => void;
  onAddToCart?: () => void;
  onShowRelatedOptions?: () => void;
  cartQuantity?: number;
  isIngredientAlert?: boolean;
}

const DishCard: React.FC<DishCardProps> = ({
  dish,
  onOpen,
  onAddToCart,
  onShowRelatedOptions,
  cartQuantity = 0,
  isIngredientAlert = false,
}) => {
  const { t, i18n } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [showDollarRate, setShowDollarRate] = useState(false);
  const articleRef = useRef<HTMLElement>(null);
  const tags = useMemo(() => getDishTags(dish), [dish, i18n.resolvedLanguage]);
  const currency = normalizeCurrency(dish.currency);
  const priceLabel = formatPriceWithCurrency(Number(dish.price), currency);
  const dollarRateLabel = formatDollarRate(currency, dish.dollar_rate);
  const caloriesText = typeof dish.calories === 'number' ? t('dishCard.calories', { count: dish.calories }) : null;
  const isOutOfStock = dish.is_orderable === false || dish.is_out_of_stock === true;

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

          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-5">
            <h3 className="min-w-0 font-serif text-2xl leading-tight text-[var(--guest-text)] sm:text-[1.75rem]">{dish.name}</h3>

            <div className="min-w-[86px] pt-1 text-right">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setShowDollarRate((current) => !current);
                }}
                className="text-xs font-medium tracking-[0.06em] text-[var(--guest-muted)] transition hover:text-[var(--guest-text)]"
                aria-label="Show dollar rate"
              >
                {priceLabel}
              </button>
              {showDollarRate ? (
                <p className="mt-1 text-[10px] font-medium leading-4 text-[var(--guest-muted)]">
                  {dollarRateLabel}
                </p>
              ) : null}
            </div>
          </div>

          <p className="mt-3 pr-1 line-clamp-3 text-sm leading-7 text-[var(--guest-muted)]">{dish.description}</p>

          <DishTags tags={tags} className="mt-4" />

          <div className="mt-5 space-y-4">
            <div className="min-h-5 text-sm">
              {caloriesText ? (
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--guest-muted)]">{caloriesText}</p>
              ) : null}
            </div>

            <div className="flex w-full gap-2 sm:justify-end">
              {isOutOfStock && onShowRelatedOptions ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onShowRelatedOptions();
                  }}
                  className={cx(
                    'w-full rounded-full border px-4 py-3 text-sm font-semibold sm:min-w-[180px]',
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
                  {cartQuantity > 0 ? t('dishCard.addMore', { count: cartQuantity }) : t('dishCard.addToCart')}
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
