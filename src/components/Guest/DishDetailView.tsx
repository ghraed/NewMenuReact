import React from 'react';
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
import { buildGuestDishIngredientsPath, buildGuestDishPath } from '../../utils/guestTableRoutes';
import { formatPriceWithCurrency } from '../../utils/currency';

interface DishDetailViewProps {
  dish: Dish;
  tableId?: number;
  restaurantSlug?: string;
  onAddToCart?: () => void;
  cartQuantity?: number;
}

const DishDetailView: React.FC<DishDetailViewProps> = ({
  dish,
  tableId,
  restaurantSlug,
  onAddToCart,
  cartQuantity = 0,
}) => {
  const { t } = useTranslation();
  const priceLabel = formatPriceWithCurrency(Number(dish.price), dish.currency);
  const caloriesText = typeof dish.calories === 'number' ? `${dish.calories} cal` : null;
  const editorialLabel = getDishEditorialLabel(dish);
  const metadataTags = getDishTags(dish);
  const hasIngredientStory = (dish.dish_ingredients || []).some(
    (row) => row.show_in_animation !== false
  );
  const isOutOfStock = dish.is_orderable === false || dish.is_out_of_stock === true;
  const alternativeDishes = dish.alternative_dishes || [];
  const suggestedDishes = dish.suggested_dishes || [];
  const relatedDishes = dish.related_dishes || [];
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
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--guest-accent)]">{t('dishDetail.experience')}</p>
          <h2 className="mt-3 font-serif text-2xl text-[var(--guest-text)] sm:text-3xl">{t('dishDetail.explorePlatedForm')}</h2>

          <div className="mt-5">
            <DishViewer
              dish={dish}
              viewerClassName="h-[22rem] sm:h-[26rem] lg:h-[34rem]"
              presentationMode="guest-detail"
            />
          </div>

          <div className="mt-5">
            {hasIngredientStory ? (
              <Link
                to={tableId
                  ? buildGuestDishIngredientsPath(tableId, dish.id)
                  : restaurantSlug
                    ? `/menu/${restaurantSlug}/dish/${dish.id}/ingredients`
                    : `/menu/dish/${dish.id}/ingredients`}
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

            <span
              className="shrink-0 rounded-full border px-4 py-2 text-lg font-semibold"
              style={{
                backgroundColor: 'var(--guest-accent-soft)',
                borderColor: 'var(--guest-border)',
                color: 'var(--guest-accent)',
              }}
            >
              {priceLabel}
            </span>
          </div>

          <DishTags tags={metadataTags} className="mt-5" />

          {onAddToCart ? (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onAddToCart}
                disabled={isOutOfStock}
                className="inline-flex items-center justify-center rounded-full border px-6 py-3 text-sm font-semibold transition hover:shadow-[0_14px_30px_rgba(0,0,0,0.16)]"
                style={{
                  backgroundColor: 'var(--guest-accent)',
                  borderColor: 'var(--guest-accent)',
                  color: 'var(--guest-accent-button-text)',
                  boxShadow: 'var(--guest-shadow-soft)',
                  opacity: isOutOfStock ? 0.7 : 1,
                  cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                }}
              >
                {isOutOfStock
                  ? t('dishCard.outOfStock')
                  : (cartQuantity > 0 ? t('dishDetail.addAnother', { count: cartQuantity }) : t('dishCard.addToCart'))}
              </button>
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
                        ? buildGuestDishPath(tableId, suggestedDish.id)
                        : restaurantSlug
                          ? `/menu/${restaurantSlug}/dish/${suggestedDish.id}`
                          : `/menu/dish/${suggestedDish.id}`}
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
                        ? buildGuestDishPath(tableId, alternativeDish.id)
                        : restaurantSlug
                          ? `/menu/${restaurantSlug}/dish/${alternativeDish.id}`
                          : `/menu/dish/${alternativeDish.id}`}
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
                        ? buildGuestDishPath(tableId, relatedDish.id)
                        : restaurantSlug
                          ? `/menu/${restaurantSlug}/dish/${relatedDish.id}`
                          : `/menu/dish/${relatedDish.id}`}
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
