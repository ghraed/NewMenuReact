import type { Dish } from '../../types';

const hasKeyword = (text: string, keywords: string[]) => keywords.some((keyword) => text.includes(keyword));

const unique = (items: string[]) => Array.from(new Set(items.filter(Boolean)));

const oceanKeywords = ['fish', 'salmon', 'tuna', 'shrimp', 'lobster', 'ocean', 'sea', 'crab', 'prawn'];
const gardenKeywords = ['veg', 'vegetable', 'salad', 'mushroom', 'herb', 'garden'];
const fireKeywords = ['spicy', 'chili', 'pepper', 'grill', 'smoked', 'jalapeno'];
const pastryKeywords = ['dessert', 'chocolate', 'vanilla', 'caramel', 'cream', 'sweet'];
const chefKeywords = ['chef', 'signature', 'special', 'truffle'];

export const getDishEditorialLabel = (dish: Dish): string | null => {
  const text = `${dish.name} ${dish.description} ${dish.category}`.toLowerCase();

  if (hasKeyword(text, oceanKeywords)) return 'Ocean notes';
  if (hasKeyword(text, chefKeywords)) return 'Chef selection';
  if (hasKeyword(text, gardenKeywords)) return 'Garden selection';
  if (hasKeyword(text, fireKeywords)) return 'Fire notes';
  if (hasKeyword(text, pastryKeywords)) return 'Pastry notes';
  return null;
};

export const getDishTags = (dish: Dish): string[] => {
  const text = `${dish.name} ${dish.description} ${dish.category}`.toLowerCase();
  const tags = [dish.category];

  if (hasKeyword(text, chefKeywords)) tags.push('Signature');
  if (hasKeyword(text, gardenKeywords)) tags.push('Vegetarian');
  if (hasKeyword(text, fireKeywords)) tags.push('Spicy');
  if (hasKeyword(text, oceanKeywords)) tags.push('Seafood');
  if (!hasKeyword(text, pastryKeywords) && /main|entree|course|steak|lamb|pasta/.test(text)) tags.push('Main Course');
  if (/starter|amuse|small plate|appetizer/.test(text)) tags.push('Luxury Starter');

  return unique(tags).slice(0, 5);
};

export const getDishPairing = (dish: Dish): string => {
  const text = `${dish.name} ${dish.description} ${dish.category}`.toLowerCase();

  if (hasKeyword(text, oceanKeywords)) return 'A mineral white wine or a brisk citrus-forward spritz complements the saline, coastal profile.';
  if (hasKeyword(text, pastryKeywords)) return 'Pair with espresso, late-harvest pours, or a restrained dessert wine to keep the finish elegant.';
  if (hasKeyword(text, fireKeywords)) return 'A chilled rose or a light red softens heat while keeping the plate lively and precise.';
  if (hasKeyword(text, gardenKeywords)) return 'Fresh herbal infusions and crisp whites keep the dish lifted and clean.';
  return 'A balanced house pairing with bright acidity and gentle structure keeps the experience polished from first bite to finish.';
};

export const getDishIngredientsText = (dish: Dish): string => {
  const parts = dish.description
    .split(/[,.;]/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return unique(parts).slice(0, 3).join(', ');
  }

  const text = `${dish.name} ${dish.description} ${dish.category}`.toLowerCase();

  if (hasKeyword(text, oceanKeywords)) return 'Sea-led ingredients, aromatic herbs, restrained citrus, and a refined finishing sauce.';
  if (hasKeyword(text, gardenKeywords)) return 'Seasonal produce, herbaceous accents, gentle textures, and a bright final seasoning.';
  if (hasKeyword(text, pastryKeywords)) return 'Layered sweetness, soft cream notes, and a composed finish built for a delicate close.';
  return 'Thoughtful seasonal ingredients arranged for balance, texture, and a clean premium presentation.';
};

