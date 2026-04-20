import type { Dish } from '../../types';
import i18n from '../../i18n';
import { translateIngredientLabel } from '../../i18n/ingredients';
import { translateCategoryLabel } from '../../i18n/dynamic';

const hasKeyword = (text: string, keywords: string[]) => keywords.some((keyword) => text.includes(keyword));

const unique = (items: string[]) => Array.from(new Set(items.filter(Boolean)));

const oceanKeywords = ['fish', 'salmon', 'tuna', 'shrimp', 'lobster', 'ocean', 'sea', 'crab', 'prawn'];
const gardenKeywords = ['veg', 'vegetable', 'salad', 'mushroom', 'herb', 'garden'];
const fireKeywords = ['spicy', 'chili', 'pepper', 'grill', 'smoked', 'jalapeno'];
const pastryKeywords = ['dessert', 'chocolate', 'vanilla', 'caramel', 'cream', 'sweet'];
const chefKeywords = ['chef', 'signature', 'special', 'truffle'];

export const getDishEditorialLabel = (dish: Dish): string | null => {
  const text = `${dish.name} ${dish.description} ${dish.category} ${dish.category_ar || ''}`.toLowerCase();

  if (hasKeyword(text, oceanKeywords)) return i18n.t('dynamic.editorial.oceanNotes');
  if (hasKeyword(text, chefKeywords)) return i18n.t('dynamic.editorial.chefSelection');
  if (hasKeyword(text, gardenKeywords)) return i18n.t('dynamic.editorial.gardenSelection');
  if (hasKeyword(text, fireKeywords)) return i18n.t('dynamic.editorial.fireNotes');
  if (hasKeyword(text, pastryKeywords)) return i18n.t('dynamic.editorial.pastryNotes');
  return null;
};

export const getDishTags = (dish: Dish): string[] => {
  const text = `${dish.name} ${dish.description} ${dish.category} ${dish.category_ar || ''}`.toLowerCase();
  const tags = [translateCategoryLabel(dish.category, dish.category_ar)];

  if (hasKeyword(text, chefKeywords)) tags.push(i18n.t('dynamic.tags.signature'));
  if (hasKeyword(text, gardenKeywords)) tags.push(i18n.t('dynamic.tags.vegetarian'));
  if (hasKeyword(text, fireKeywords)) tags.push(i18n.t('dynamic.tags.spicy'));
  if (hasKeyword(text, oceanKeywords)) tags.push(i18n.t('dynamic.tags.seafood'));
  if (!hasKeyword(text, pastryKeywords) && /main|entree|course|steak|lamb|pasta/.test(text)) tags.push(i18n.t('dynamic.tags.mainCourse'));
  if (/starter|amuse|small plate|appetizer/.test(text)) tags.push(i18n.t('dynamic.tags.luxuryStarter'));

  return unique(tags).slice(0, 5);
};

export const getDishPairing = (dish: Dish): string => {
  const text = `${dish.name} ${dish.description} ${dish.category} ${dish.category_ar || ''}`.toLowerCase();

  if (hasKeyword(text, oceanKeywords)) return i18n.t('dynamic.pairing.ocean');
  if (hasKeyword(text, pastryKeywords)) return i18n.t('dynamic.pairing.pastry');
  if (hasKeyword(text, fireKeywords)) return i18n.t('dynamic.pairing.fire');
  if (hasKeyword(text, gardenKeywords)) return i18n.t('dynamic.pairing.garden');
  return i18n.t('dynamic.pairing.default');
};

export const getDishIngredientsText = (dish: Dish): string => {
  const recipeIngredients = (dish.dish_ingredients || [])
    .sort((left, right) => (left.order_index ?? 0) - (right.order_index ?? 0))
    .map((row) => row.ingredient?.name?.trim() || null)
    .filter((name): name is string => Boolean(name));

  if (recipeIngredients.length > 0) {
    return unique(recipeIngredients)
      .map((ingredient) => translateIngredientLabel(ingredient, i18n.resolvedLanguage))
      .join(', ');
  }

  const parts = dish.description
    .split(/[,.;]/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 1) {
    return unique(parts).slice(0, 3).join(', ');
  }

  const text = `${dish.name} ${dish.description} ${dish.category} ${dish.category_ar || ''}`.toLowerCase();

  if (hasKeyword(text, oceanKeywords)) return i18n.t('dynamic.ingredients.ocean');
  if (hasKeyword(text, gardenKeywords)) return i18n.t('dynamic.ingredients.garden');
  if (hasKeyword(text, pastryKeywords)) return i18n.t('dynamic.ingredients.pastry');
  return dish.description?.trim() || translateCategoryLabel(dish.category, dish.category_ar) || dish.name;
};
