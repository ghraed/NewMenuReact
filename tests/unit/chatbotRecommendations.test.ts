import { describe, expect, it } from 'vitest';
import {
  resolveChatRecommendation,
  responseExplicitlyRecommendsDishName,
  type ChatRecommendationDish,
} from '../../src/utils/chatbotRecommendations';

const makeDish = (overrides: Partial<ChatRecommendationDish>): ChatRecommendationDish => ({
  id: overrides.id ?? 1,
  name: overrides.name ?? 'Dish',
  nameAr: overrides.nameAr ?? null,
  category: overrides.category ?? 'Mains',
  categoryAr: overrides.categoryAr ?? null,
  imageUrl: overrides.imageUrl,
  isProfitable: overrides.isProfitable ?? false,
  isOrderable: overrides.isOrderable ?? true,
  isOutOfStock: overrides.isOutOfStock ?? false,
  suggestedDishIds: overrides.suggestedDishIds ?? [],
  relatedDishIds: overrides.relatedDishIds ?? [],
  relationsLoaded: overrides.relationsLoaded ?? true,
});

describe('chatbot recommendations', () => {
  it('prefers profitable dishes for category requests', () => {
    const dishes = [
      makeDish({ id: 1, name: 'Margherita Pizza', category: 'Pizza' }),
      makeDish({ id: 2, name: 'BBQ Chicken Pizza', category: 'Pizza', isProfitable: true }),
      makeDish({ id: 3, name: 'Buffalo Chicken Pizza', category: 'Pizza' }),
    ];

    const result = resolveChatRecommendation('what pizza do you have?', dishes);

    expect(result.type).toBe('category');
    expect(result.dishes[0]?.name).toBe('BBQ Chicken Pizza');
  });

  it('prefers profitable related dishes for direct dish questions', () => {
    const dishes = [
      makeDish({ id: 1, name: 'Margherita Pizza', category: 'Pizza', suggestedDishIds: [2, 3] }),
      makeDish({ id: 2, name: 'BBQ Chicken Pizza', category: 'Pizza', isProfitable: true }),
      makeDish({ id: 3, name: 'Four Cheese Pizza', category: 'Pizza' }),
    ];

    const result = resolveChatRecommendation('tell me about margherita pizza', dishes);

    expect(result.type).toBe('direct');
    expect(result.dishes[0]?.name).toBe('BBQ Chicken Pizza');
  });

  it('falls back to other related dishes before same-category profitable dishes', () => {
    const dishes = [
      makeDish({ id: 1, name: 'Margherita Pizza', category: 'Pizza', relatedDishIds: [3] }),
      makeDish({ id: 2, name: 'BBQ Chicken Pizza', category: 'Pizza', isProfitable: true }),
      makeDish({ id: 3, name: 'Four Cheese Pizza', category: 'Pizza' }),
    ];

    const result = resolveChatRecommendation('tell me about margherita pizza', dishes);

    expect(result.type).toBe('direct');
    expect(result.dishes[0]?.name).toBe('Four Cheese Pizza');
  });

  it('falls back to same-category profitable dishes when no related dishes exist', () => {
    const dishes = [
      makeDish({ id: 1, name: 'Margherita Pizza', category: 'Pizza' }),
      makeDish({ id: 2, name: 'BBQ Chicken Pizza', category: 'Pizza', isProfitable: true }),
      makeDish({ id: 3, name: 'Pepperoni Pizza', category: 'Pizza' }),
    ];

    const result = resolveChatRecommendation('tell me about margherita pizza', dishes);

    expect(result.type).toBe('direct');
    expect(result.dishes[0]?.name).toBe('BBQ Chicken Pizza');
  });

  it('falls back to standard same-category dishes when no profitable fallback exists', () => {
    const dishes = [
      makeDish({ id: 1, name: 'Cheesy Fries', category: 'Fries' }),
      makeDish({ id: 2, name: 'French Fries', category: 'Fries' }),
      makeDish({ id: 3, name: 'Curly Fries', category: 'Fries' }),
    ];

    const result = resolveChatRecommendation('tell me about cheesy fries', dishes);

    expect(result.type).toBe('direct');
    expect(result.dishes[0]?.name).toBe('Curly Fries');
    expect(result.dishes.map((dish) => dish.name)).not.toContain('Cheesy Fries');
  });

  it('uses profitable dishes for broad recommendation requests', () => {
    const dishes = [
      makeDish({ id: 1, name: 'Margherita Pizza', category: 'Pizza' }),
      makeDish({ id: 2, name: 'BBQ Chicken Pizza', category: 'Pizza', isProfitable: true }),
      makeDish({ id: 3, name: 'Pomegranate Spritz', category: 'Drinks', isProfitable: true }),
    ];

    const result = resolveChatRecommendation('what dish do you suggest?', dishes);

    expect(result.type).toBe('global');
    expect(result.dishes.map((dish) => dish.name)).toContain('BBQ Chicken Pizza');
    expect(result.dishes.every((dish) => dish.isProfitable === true)).toBe(true);
  });

  it('excludes out-of-stock and non-orderable dishes from recommendation pools', () => {
    const dishes = [
      makeDish({ id: 1, name: 'Margherita Pizza', category: 'Pizza' }),
      makeDish({ id: 2, name: 'BBQ Chicken Pizza', category: 'Pizza', isProfitable: true, isOutOfStock: true }),
      makeDish({ id: 3, name: 'Buffalo Chicken Pizza', category: 'Pizza', isProfitable: true, isOrderable: false }),
      makeDish({ id: 4, name: 'Four Cheese Pizza', category: 'Pizza' }),
    ];

    const result = resolveChatRecommendation('what pizza do you have?', dishes);

    expect(result.type).toBe('category');
    expect(result.dishes.map((dish) => dish.name)).toEqual(['Four Cheese Pizza', 'Margherita Pizza']);
  });

  it('does not re-suggest the asked dish itself', () => {
    const dishes = [
      makeDish({ id: 1, name: 'Margherita Pizza', category: 'Pizza', relatedDishIds: [1, 2] }),
      makeDish({ id: 2, name: 'BBQ Chicken Pizza', category: 'Pizza', isProfitable: true }),
    ];

    const result = resolveChatRecommendation('tell me about margherita pizza', dishes);

    expect(result.type).toBe('direct');
    expect(result.dishes.map((dish) => dish.name)).toEqual(['BBQ Chicken Pizza']);
  });

  it('detects when the backend already explicitly recommends the same dish', () => {
    expect(
      responseExplicitlyRecommendsDishName(
        "If you want my honest pick from the pizzas, I'd start with BBQ Chicken Pizza.",
        'BBQ Chicken Pizza'
      )
    ).toBe(true);

    expect(
      responseExplicitlyRecommendsDishName(
        'BBQ Chicken Pizza comes with grilled chicken, red onions, and BBQ sauce.',
        'BBQ Chicken Pizza'
      )
    ).toBe(false);
  });
});
