import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DishCard from '../../src/components/Guest/DishCard';
import type { Dish } from '../../src/types';

vi.mock('@google/model-viewer', () => ({}));

vi.mock('../../src/components/Guest/guestPresentation', () => ({
  getDishTags: () => ['Main Courses'],
}));

vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: () => {},
  },
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const messages: Record<string, string> = {
        'dishCard.outOfStock': 'Out of stock',
        'dishCard.viewDetails': 'View details',
        'dishCard.addToCart': 'Add to cart',
        'dishCard.badgeChefRecommendation': 'Chef recommendation',
        'dishCard.calories': `${String(options?.count ?? '')} cal`,
      };

      return messages[key] ?? String(options?.defaultValue ?? key);
    },
  }),
}));

describe('DishCard', () => {
  const baseDish: Dish = {
    id: 12,
    uuid: 'dish-12',
    name: 'Halloumi Burger',
    description: 'Charred halloumi with pickles.',
    price: 14,
    currency: 'USD',
    calories: 640,
    category: 'Main Courses',
    status: 'published',
    item_type: 'prepared_dish',
    is_anchor: true,
    is_profitable: true,
    image_url: undefined,
    assets: [],
    dish_ingredients: [],
    suggested_dishes: [],
    related_dishes: [],
    created_at: '2026-07-26T12:00:00.000Z',
    updated_at: '2026-07-26T12:00:00.000Z',
  };

  it('renders fallback visuals for missing images and shows out-of-stock state', () => {
    const onOpen = vi.fn();
    const onShowRelatedOptions = vi.fn();

    render(
      <DishCard
        dish={{
          ...baseDish,
          is_orderable: false,
          is_out_of_stock: true,
        }}
        onOpen={onOpen}
        onShowRelatedOptions={onShowRelatedOptions}
      />
    );

    expect(screen.getByText('Halloumi Burger')).toBeInTheDocument();
    expect(screen.getByText('Out of stock')).toBeInTheDocument();
    expect(screen.getByText('Chef recommendation')).toBeInTheDocument();
    expect(screen.getByText('640 cal')).toBeInTheDocument();
    expect(screen.getByText('🍽')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try Similar Favorites' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'View details' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('renders add-to-cart controls for available dishes', () => {
    const onAddToCart = vi.fn();

    render(
      <DishCard
        dish={{
          ...baseDish,
          is_orderable: true,
          is_out_of_stock: false,
        }}
        onOpen={vi.fn()}
        onAddToCart={onAddToCart}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(onAddToCart).toHaveBeenCalledTimes(1);
  });
});
