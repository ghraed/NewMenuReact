import React, { useMemo } from 'react';
import type { Dish } from '../../types';
import { cx, focusRing } from '../../theme/liquidGlass';
import DishAssetThumbnail from '../Common/DishAssetThumbnail';

interface DishCardProps {
  dish: Dish;
  onOpen: () => void;
}

type TagTone = 'signature' | 'vegetarian' | 'spicy';

const tagClass: Record<TagTone, string> = {
  signature: 'border-gold/40 bg-gold/10 text-gold2',
  vegetarian: 'border-sage/35 bg-sage/10 text-sage',
  spicy: 'border-spicy/35 bg-spicy/10 text-spicy',
};

const DishCard: React.FC<DishCardProps> = ({ dish, onOpen }) => {
  const tags = useMemo(() => {
    const text = `${dish.name} ${dish.description} ${dish.category}`.toLowerCase();
    const list: Array<{ label: string; tone: TagTone }> = [];

    if (/signature|special|chef|truffle/.test(text)) {
      list.push({ label: 'Signature', tone: 'signature' });
    }
    if (/veg|vegetarian|salad|mushroom/.test(text)) {
      list.push({ label: 'Vegetarian', tone: 'vegetarian' });
    }
    if (/spicy|chili|jalapeno|pepper/.test(text)) {
      list.push({ label: 'Spicy', tone: 'spicy' });
    }

    return list.slice(0, 3);
  }, [dish]);

  const price = Number(dish.price).toFixed(2);

  return (
    <article
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
        'group relative w-full overflow-hidden rounded-xl2 border border-stroke bg-bg1 p-3 shadow-lux2',
        'transition duration-300 ease-fluid motion-reduce:transition-none motion-safe:hover:-translate-y-0.5 motion-safe:hover:scale-[1.01]',
        focusRing,
        'cursor-pointer'
      )}
    >
      <div className="relative z-10 grid min-h-[132px] grid-cols-[92px_1fr] gap-3 sm:grid-cols-[110px_1fr] sm:gap-4">
        <DishAssetThumbnail dish={dish} className="h-[92px] w-[92px] sm:h-[110px] sm:w-[110px]" />

        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <h3 className="line-clamp-2 text-base font-semibold leading-tight text-text sm:text-lg">{dish.name}</h3>
            <span className="shrink-0 rounded-full border border-gold/35 bg-gold/12 px-2.5 py-1 text-xs font-semibold text-gold2">
              ${price}
            </span>
          </div>

          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted sm:text-sm">{dish.description}</p>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted">
              {dish.category}
            </span>
            {tags.map((tag) => (
              <span
                key={tag.label}
                className={cx('rounded-full border px-2 py-0.5 text-[11px] font-medium', tagClass[tag.tone])}
              >
                {tag.label}
              </span>
            ))}
          </div>

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
              }}
              className={cx(
                'rounded-full border border-gold/45 bg-gold px-3 py-1 text-xs font-semibold text-bg0 shadow-lux2',
                'transition duration-300 ease-fluid motion-reduce:transition-none motion-safe:hover:-translate-y-0.5 motion-safe:hover:brightness-110',
                focusRing
              )}
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};

export default DishCard;
