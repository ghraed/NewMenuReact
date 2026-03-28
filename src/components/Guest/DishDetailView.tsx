import React from 'react';
import type { Dish } from '../../types';
import DishAssetThumbnail from '../Common/DishAssetThumbnail';
import DishViewer from './DishViewer';
import DishTags from './DishTags';
import {
  getDishEditorialLabel,
  getDishIngredientsText,
  getDishPairing,
  getDishTags,
} from './guestPresentation';

interface DishDetailViewProps {
  dish: Dish;
}

const DishDetailView: React.FC<DishDetailViewProps> = ({ dish }) => {
  const price = Number(dish.price).toFixed(2);
  const editorialLabel = getDishEditorialLabel(dish);
  const metadataTags = getDishTags(dish);
  const sections = [
    { title: 'Description', content: dish.description },
    { title: 'Ingredients', content: getDishIngredientsText(dish) },
    { title: 'Recommended Pairing', content: getDishPairing(dish) },
  ];

  return (
    <article className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <div className="space-y-6">
        <section
          className="rounded-[32px] border p-3 sm:p-4"
          style={{
            backgroundColor: 'var(--guest-panel)',
            borderColor: 'var(--guest-border)',
            boxShadow: 'var(--guest-shadow)',
          }}
        >
          <DishAssetThumbnail
            dish={dish}
            fit="cover"
            className="aspect-[4/5] w-full rounded-[24px] sm:aspect-[5/4] lg:aspect-[4/5]"
            imageClassName="object-cover"
            overlayClassName="bg-black/5"
          />
        </section>

        <section
          className="rounded-[32px] border p-5 sm:p-6"
          style={{
            backgroundColor: 'var(--guest-panel)',
            borderColor: 'var(--guest-border)',
            boxShadow: 'var(--guest-shadow-soft)',
          }}
        >
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--guest-accent)]">3D Experience</p>
          <h2 className="mt-3 font-serif text-2xl text-[var(--guest-text)] sm:text-3xl">Explore the plated form</h2>
          <p className="mt-2 text-sm leading-7 text-[var(--guest-muted)]">
            The existing interactive viewer and AR actions stay intact while the presentation shifts to a more minimal, editorial layout.
          </p>

          <div className="mt-5">
            <DishViewer dish={dish} viewerClassName="h-[20rem] sm:h-[24rem]" />
          </div>
        </section>
      </div>

      <div className="space-y-6">
        <section
          className="rounded-[32px] border p-6 sm:p-8"
          style={{
            backgroundColor: 'var(--guest-panel)',
            borderColor: 'var(--guest-border)',
            boxShadow: 'var(--guest-shadow)',
          }}
        >
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-[var(--guest-accent)]">
            {editorialLabel || dish.category}
          </p>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-serif text-4xl leading-tight text-[var(--guest-text)] sm:text-[3.5rem]">{dish.name}</h1>
              <p className="mt-3 max-w-2xl text-base leading-8 text-[var(--guest-muted)]">{dish.description}</p>
            </div>

            <span
              className="shrink-0 rounded-full border px-4 py-2 text-lg font-semibold"
              style={{
                backgroundColor: 'var(--guest-accent-soft)',
                borderColor: 'var(--guest-border)',
                color: 'var(--guest-accent)',
              }}
            >
              ${price}
            </span>
          </div>

          <DishTags tags={metadataTags} className="mt-5" />
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
      </div>
    </article>
  );
};

export default DishDetailView;

