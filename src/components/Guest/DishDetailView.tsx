import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Dish } from '../../types';
import DishViewer from './DishViewer';
import DishTags from './DishTags';
import DishAssetThumbnail from '../Common/DishAssetThumbnail';
import {
  getDishEditorialLabel,
  getDishIngredientsText,
  getDishPairing,
  getDishTags,
} from './guestPresentation';
import { translateCategoryLabel } from '../../i18n/dynamic';
import {
  buildGenericGuestDishPath,
  buildGenericGuestDishIngredientsPath,
  buildGuestDishIngredientsPath,
  buildGuestDishPath,
  buildGuestRestaurantDishIngredientsPath,
  buildGuestRestaurantDishPath,
} from '../../utils/guestTableRoutes';
import {
  convertPriceBetweenCurrencies,
  convertPriceFromUsdToCurrency,
  formatPriceWithCurrency,
  formatUsdEquivalent,
  normalizeCurrency,
} from '../../utils/currency';

interface DishDetailViewProps {
  dish: Dish;
  tableId?: number;
  restaurantSlug?: string;
  aiRecommendationsEnabled?: boolean;
  onAddToCart?: () => void;
  onUpdateCartQuantity?: (quantity: number) => void;
  cartQuantity?: number;
}

const sortByRecommendationPriority = (list: Dish[]): Dish[] => {
  const withIndex = list.map((dish, index) => ({ dish, index }));

  withIndex.sort((left, right) => {
    const leftScore = left.dish.is_profitable === true ? 1 : 0;
    const rightScore = right.dish.is_profitable === true ? 1 : 0;

    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    return left.index - right.index;
  });

  return withIndex.map((entry) => entry.dish);
};

const pickProfitableRelatedDishes = (list: Dish[]): Dish[] => {
  const profitableRelated = list.filter((candidate) => candidate.is_profitable === true);
  if (profitableRelated.length > 0) {
    return sortByRecommendationPriority(profitableRelated);
  }

  return sortByRecommendationPriority(list);
};

const DishDetailView: React.FC<DishDetailViewProps> = ({
  dish,
  tableId,
  restaurantSlug,
  aiRecommendationsEnabled = true,
  onAddToCart,
  onUpdateCartQuantity,
  cartQuantity = 0,
}) => {
  const { t } = useTranslation();
  const [showDollarRate, setShowDollarRate] = useState(false);
  const currency = normalizeCurrency(dish.currency);
  const originalCurrency = normalizeCurrency(dish.original_currency || dish.currency);
  const priceLabel = formatPriceWithCurrency(Number(dish.price), currency);
  const clickLabel = useMemo(() => {
    const amount = Number(dish.price);
    const hasRate = typeof dish.dollar_rate === 'number' && Number.isFinite(dish.dollar_rate) && dish.dollar_rate > 0;

    if (hasRate && originalCurrency !== currency && (currency === 'USD' || originalCurrency === 'USD')) {
      const converted = convertPriceBetweenCurrencies(amount, currency, originalCurrency, dish.dollar_rate);
      return formatPriceWithCurrency(converted, originalCurrency);
    }

    if (dish.price_is_usd_base === true && currency === 'USD' && originalCurrency !== 'USD' && hasRate) {
      const converted = convertPriceFromUsdToCurrency(amount, originalCurrency, dish.dollar_rate);
      return formatPriceWithCurrency(converted, originalCurrency);
    }

    return formatUsdEquivalent(amount, currency, dish.dollar_rate);
  }, [dish.price, dish.price_is_usd_base, dish.dollar_rate, currency, originalCurrency]);
  const caloriesText = typeof dish.calories === 'number' ? `${dish.calories} cal` : null;
  const editorialLabel = getDishEditorialLabel(dish);
  const metadataTags = getDishTags(dish);
  const isPackagedItem = dish.item_type === 'packaged_drink' || dish.item_type === 'other_product';
  const hasIngredientStory = (dish.dish_ingredients || []).some(
    (row) => row.show_in_animation !== false
  );
  const isOutOfStock = dish.is_orderable === false || dish.is_out_of_stock === true;
  const alternativeDishes = aiRecommendationsEnabled
    ? sortByRecommendationPriority(dish.alternative_dishes || [])
    : [];
  const suggestedDishes = aiRecommendationsEnabled
    ? sortByRecommendationPriority(dish.suggested_dishes || [])
    : [];
  const relatedDishes = aiRecommendationsEnabled
    ? pickProfitableRelatedDishes(dish.related_dishes || [])
    : [];
  const sections = [
    { title: t('dishDetail.description'), content: dish.description },
    { title: t('dishDetail.ingredients'), content: getDishIngredientsText(dish) },
    { title: t('dishDetail.recommendedPairing'), content: getDishPairing(dish) },
  ];

  return (
    <article className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <div className="min-w-0 space-y-6">
        <section
          className="rounded-[32px] border p-5 sm:p-6"
          style={{
            backgroundColor: 'var(--guest-panel)',
            borderColor: 'var(--guest-border)',
            boxShadow: 'var(--guest-shadow)',
          }}
        >
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--guest-accent)]">
            {isPackagedItem ? 'View Image' : t('dishDetail.experience')}
          </p>
          <h2 className="mt-3 font-serif text-2xl text-[var(--guest-text)] sm:text-3xl">
            {isPackagedItem ? dish.name : t('dishDetail.explorePlatedForm')}
          </h2>

          <div className="mt-5">
            <DishViewer
              dish={dish}
              viewerClassName="h-[22rem] sm:h-[26rem] lg:h-[34rem]"
              presentationMode="guest-detail"
            />
          </div>

          {!isPackagedItem ? (
          <div className="mt-5">
            {hasIngredientStory ? (
              <Link
                to={tableId
                  ? buildGuestDishIngredientsPath(tableId, dish.id, dish.name)
                  : restaurantSlug
                    ? buildGuestRestaurantDishIngredientsPath(restaurantSlug, dish.id, dish.name)
                    : buildGenericGuestDishIngredientsPath(dish.id, dish.name)}
                className="inline-flex w-full items-center justify-center rounded-full border px-6 py-4 text-center text-sm font-semibold transition hover:shadow-[0_14px_30px_rgba(0,0,0,0.16)]"
                style={{
                  backgroundColor: 'var(--guest-accent)',
                  borderColor: 'var(--guest-accent)',
                  color: 'var(--guest-accent-button-text)',
                  boxShadow: 'var(--guest-shadow-soft)',
                }}
              >
                {t('dishDetail.viewIngredientStory')}
              </Link>
            ) : (
              <p className="text-sm text-[var(--guest-muted)]">
                {t('dishDetail.ingredientStoryUnavailable')}
              </p>
            )}
          </div>
          ) : null}
        </section>
      </div>

      <div className="min-w-0 space-y-6">
        <section
          className="rounded-[32px] border p-6 sm:p-8"
          style={{
            backgroundColor: 'var(--guest-panel)',
            borderColor: 'var(--guest-border)',
            boxShadow: 'var(--guest-shadow)',
          }}
        >
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-[var(--guest-accent)]">
            {editorialLabel || translateCategoryLabel(dish.category, dish.category_ar)} {caloriesText ? `- ${caloriesText}` : ''}
          </p>
          {isOutOfStock ? (
            <p className="mt-3 inline-flex rounded-full border border-spicy/40 bg-spicy/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-spicy">
              {t('dishCard.outOfStock')}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-serif text-4xl leading-tight text-[var(--guest-text)] sm:text-[3.5rem]">{dish.name}</h1>
              <p className="mt-3 max-w-2xl text-base leading-8 text-[var(--guest-muted)]">{dish.description}</p>
              {/* {caloriesText ? (
                <p className="mt-3 text-sm font-medium uppercase tracking-[0.18em] text-[var(--guest-accent)]">
                  - {caloriesText}
                </p>
              ) : null} */}
            </div>

            <div className="shrink-0 text-right">
              <button
                type="button"
                onClick={() => setShowDollarRate((current) => !current)}
                className="ml-auto block rounded-full border px-4 py-2 text-lg font-semibold transition hover:shadow-[0_12px_28px_rgba(0,0,0,0.16)]"
                style={{
                  backgroundColor: 'var(--guest-accent-soft)',
                  borderColor: 'var(--guest-border)',
                  color: 'var(--guest-accent)',
                }}
                aria-label="Show currency rate"
              >
                {priceLabel}
              </button>
              {showDollarRate ? (
                <p className="mt-2 block text-xs font-medium leading-5 text-[var(--guest-muted)]">
                  {clickLabel}
                </p>
              ) : null}
            </div>
          </div>

          <DishTags tags={metadataTags} className="mt-5" />

          {onAddToCart ? (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {isOutOfStock ? (
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center justify-center rounded-full border px-6 py-3 text-sm font-semibold"
                  style={{
                    backgroundColor: 'var(--guest-accent)',
                    borderColor: 'var(--guest-accent)',
                    color: 'var(--guest-accent-button-text)',
                    boxShadow: 'var(--guest-shadow-soft)',
                    opacity: 0.7,
                    cursor: 'not-allowed',
                  }}
                >
                  {t('dishCard.outOfStock')}
                </button>
              ) : cartQuantity > 0 ? (
                <div
                  className="grid w-full max-w-[320px] grid-cols-[auto_1fr_auto] items-center rounded-full border"
                  style={{
                    backgroundColor: 'var(--guest-accent)',
                    borderColor: 'var(--guest-accent)',
                    color: 'var(--guest-accent-button-text)',
                    boxShadow: 'var(--guest-shadow-soft)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onUpdateCartQuantity?.(Math.max(0, cartQuantity - 1))}
                    className="inline-flex min-h-[48px] items-center justify-center rounded-l-full px-5 text-lg font-semibold"
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
                    className="w-full bg-transparent px-1 text-center text-sm font-semibold text-[var(--guest-accent-button-text)] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    aria-label="Quantity"
                  />
                  <button
                    type="button"
                    onClick={onAddToCart}
                    className="inline-flex min-h-[48px] items-center justify-center rounded-r-full px-5 text-lg font-semibold"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onAddToCart}
                  className="inline-flex items-center justify-center rounded-full border px-6 py-3 text-sm font-semibold transition hover:shadow-[0_14px_30px_rgba(0,0,0,0.16)]"
                  style={{
                    backgroundColor: 'var(--guest-accent)',
                    borderColor: 'var(--guest-accent)',
                    color: 'var(--guest-accent-button-text)',
                    boxShadow: 'var(--guest-shadow-soft)',
                  }}
                >
                  {t('dishCard.addToCart')}
                </button>
              )}
              {isOutOfStock ? (
                <p className="text-sm text-spicy">
                  {t('dishDetail.outOfStockNote')}
                </p>
              ) : null}
              {cartQuantity > 0 && !isOutOfStock ? (
                <p className="text-sm text-[var(--guest-muted)]">
                  {t('dishDetail.reviewCartHint')}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        <div className="grid gap-4">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-[28px] border p-5 sm:p-6"
              style={{
                backgroundColor: 'var(--guest-panel)',
                borderColor: 'var(--guest-border-soft)',
                boxShadow: 'var(--guest-shadow-soft)',
              }}
            >
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--guest-accent)]">{section.title}</p>
              <p className="mt-3 text-sm leading-7 text-[var(--guest-muted)] sm:text-base">{section.content}</p>
            </section>
          ))}
        </div>

        {suggestedDishes.length > 0 ? (
          <section
            className="min-w-0 max-w-full rounded-[28px] border p-5 sm:p-6"
            style={{
              backgroundColor: 'var(--guest-panel)',
              borderColor: 'var(--guest-border-soft)',
              boxShadow: 'var(--guest-shadow-soft)',
            }}
          >
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--guest-accent)]">
              {t('dishDetail.restaurantSuggests')}
            </p>

            <div className="mt-4 max-w-full overflow-x-auto overflow-y-hidden pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [touch-action:pan-x] overscroll-x-contain">
              <div className="inline-flex min-w-max gap-3 no-scrollbar">
                {suggestedDishes.map((suggestedDish) => {
                  const content = (
                    <div
                      className="w-[260px] shrink-0 rounded-[24px] border p-3 transition hover:ring-1 hover:ring-white/10 hover:shadow-[0_16px_34px_rgba(0,0,0,0.14)] sm:w-[280px]"
                      style={{
                        backgroundColor: 'var(--guest-panel-strong)',
                        borderColor: 'var(--guest-border)',
                      }}
                    >
                      <DishAssetThumbnail dish={suggestedDish} fit="cover" className="aspect-[4/3] w-full" />
                      <div className="mt-3">
                        <p className="font-serif text-xl text-[var(--guest-text)]">{suggestedDish.name}</p>
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--guest-muted)]">
                          {suggestedDish.description}
                        </p>
                      </div>
                    </div>
                  );

                  return (
                    <Link
                      key={suggestedDish.id}
                        to={tableId
                          ? buildGuestDishPath(tableId, suggestedDish.id, suggestedDish.name)
                          : restaurantSlug
                            ? buildGuestRestaurantDishPath(restaurantSlug, suggestedDish.id, suggestedDish.name)
                            : buildGenericGuestDishPath(suggestedDish.id, suggestedDish.name)}
                      className="block shrink-0"
                    >
                      {content}
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        {isOutOfStock && alternativeDishes.length > 0 ? (
          <section
            className="min-w-0 max-w-full rounded-[28px] border p-5 sm:p-6"
            style={{
              backgroundColor: 'var(--guest-panel)',
              borderColor: 'var(--guest-border-soft)',
              boxShadow: 'var(--guest-shadow-soft)',
            }}
          >
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--guest-accent)]">
              {t('dishDetail.availableAlternatives')}
            </p>

            <div className="mt-4 max-w-full overflow-x-auto overflow-y-hidden pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [touch-action:pan-x] overscroll-x-contain">
              <div className="inline-flex min-w-max gap-3 no-scrollbar">
                {alternativeDishes.map((alternativeDish) => {
                  const content = (
                    <div
                      className="w-[260px] shrink-0 rounded-[24px] border p-3 transition hover:ring-1 hover:ring-white/10 hover:shadow-[0_16px_34px_rgba(0,0,0,0.14)] sm:w-[280px]"
                      style={{
                        backgroundColor: 'var(--guest-panel-strong)',
                        borderColor: 'var(--guest-border)',
                      }}
                    >
                      <DishAssetThumbnail dish={alternativeDish} fit="cover" className="aspect-[4/3] w-full" />
                      <div className="mt-3">
                        <p className="font-serif text-xl text-[var(--guest-text)]">{alternativeDish.name}</p>
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--guest-muted)]">
                          {alternativeDish.description}
                        </p>
                      </div>
                    </div>
                  );

                  return (
                    <Link
                      key={alternativeDish.id}
                        to={tableId
                          ? buildGuestDishPath(tableId, alternativeDish.id, alternativeDish.name)
                          : restaurantSlug
                            ? buildGuestRestaurantDishPath(restaurantSlug, alternativeDish.id, alternativeDish.name)
                            : buildGenericGuestDishPath(alternativeDish.id, alternativeDish.name)}
                      className="block shrink-0"
                    >
                      {content}
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        {relatedDishes.length > 0 ? (
          <section
            className="min-w-0 max-w-full rounded-[28px] border p-5 sm:p-6"
            style={{
              backgroundColor: 'var(--guest-panel)',
              borderColor: 'var(--guest-border-soft)',
              boxShadow: 'var(--guest-shadow-soft)',
            }}
          >
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--guest-accent)]">
              {t('dishDetail.relatedDishes')}
            </p>

            <div className="mt-4 max-w-full overflow-x-auto overflow-y-hidden pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [touch-action:pan-x] overscroll-x-contain">
              <div className="inline-flex min-w-max gap-3 no-scrollbar">
                {relatedDishes.map((relatedDish) => {
                  const content = (
                    <div
                      className="w-[260px] shrink-0 rounded-[24px] border p-3 transition hover:ring-1 hover:ring-white/10 hover:shadow-[0_16px_34px_rgba(0,0,0,0.14)] sm:w-[280px]"
                      style={{
                        backgroundColor: 'var(--guest-panel-strong)',
                        borderColor: 'var(--guest-border)',
                      }}
                    >
                      <DishAssetThumbnail dish={relatedDish} fit="cover" className="aspect-[4/3] w-full" />
                      <div className="mt-3">
                        <p className="font-serif text-xl text-[var(--guest-text)]">{relatedDish.name}</p>
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--guest-muted)]">
                          {relatedDish.description}
                        </p>
                      </div>
                    </div>
                  );

                  return (
                    <Link
                      key={relatedDish.id}
                        to={tableId
                          ? buildGuestDishPath(tableId, relatedDish.id, relatedDish.name)
                          : restaurantSlug
                            ? buildGuestRestaurantDishPath(restaurantSlug, relatedDish.id, relatedDish.name)
                            : buildGenericGuestDishPath(relatedDish.id, relatedDish.name)}
                      className="block shrink-0"
                    >
                      {content}
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </article>
  );
};

export default DishDetailView;
