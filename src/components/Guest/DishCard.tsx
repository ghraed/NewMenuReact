import React, { useMemo } from 'react';
import type { Dish } from '../../types';
import { cx, focusRing } from '../../theme/liquidGlass';
import DishAssetThumbnail from '../Common/DishAssetThumbnail';
import DishTags from './DishTags';
import { getDishEditorialLabel, getDishTags } from './guestPresentation';

interface DishCardProps {
  dish: Dish;
  onOpen: () => void;
}

const DishCard: React.FC<DishCardProps> = ({ dish, onOpen }) => {
  const tags = useMemo(() => getDishTags(dish), [dish]);
  const editorialLabel = useMemo(() => getDishEditorialLabel(dish), [dish]);

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
        'group relative w-full overflow-hidden rounded-[28px] border p-3 sm:p-4',
        'transition duration-300 ease-fluid motion-reduce:transition-none motion-safe:hover:-translate-y-1',
        focusRing,
        'cursor-pointer'
      )}
      style={{
        backgroundColor: 'var(--guest-panel)',
        borderColor: 'var(--guest-border)',
        boxShadow: 'var(--guest-shadow-soft)',
      }}
    >
      <div className="relative z-10">
        <DishAssetThumbnail
          dish={dish}
          fit="cover"
          className="aspect-[4/3] w-full"
          imageClassName="transition duration-500 ease-fluid group-hover:scale-[1.03]"
          overlayClassName="bg-black/5"
        />

        <div className="min-w-0 px-1 pb-1 pt-4">
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
            <div className="min-h-5 text-sm text-[var(--guest-accent)]">
              {editorialLabel ? <span className="font-medium">{editorialLabel}</span> : null}
            </div>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onOpen();
              }}
              className={cx(
                'w-full rounded-full border px-4 py-3 text-sm font-semibold sm:w-auto sm:min-w-[160px]',
                'transition duration-300 ease-fluid motion-reduce:transition-none motion-safe:hover:-translate-y-0.5',
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
    </article>
  );
};

export default DishCard;
