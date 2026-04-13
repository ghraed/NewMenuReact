export interface MenuCategoryDefinition {
  value: string;
  arabic: string;
  aliases?: string[];
}

export const MENU_CATEGORIES: MenuCategoryDefinition[] = [
  { value: 'Pizza', arabic: 'بيتزا', aliases: ['pizza'] },
  { value: 'Specialty Pizza', arabic: 'بيتزا خاصة', aliases: ['specialty pizza'] },
  { value: 'Burgers', arabic: 'برغر', aliases: ['burger', 'burgers'] },
  { value: 'Sandwiches', arabic: 'ساندويتشات', aliases: ['sandwich', 'sandwiches'] },
  { value: 'Pasta', arabic: 'باستا', aliases: ['pasta'] },
  { value: 'Salads', arabic: 'سلطات', aliases: ['salad', 'salads'] },
  { value: 'Appetizers', arabic: 'مقبلات', aliases: ['appetizer', 'appetizers'] },
  { value: 'Sides', arabic: 'أطباق جانبية', aliases: ['side', 'sides'] },
  { value: 'Desserts', arabic: 'حلويات', aliases: ['dessert', 'desserts', 'sweet', 'sweets'] },
  { value: 'Drinks', arabic: 'مشروبات', aliases: ['drink', 'drinks', 'beverage', 'beverages'] },
];

const normalizeCategoryValue = (value?: string | null): string => (
  (value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
);

export const findMenuCategory = (value?: string | null): MenuCategoryDefinition | null => {
  const normalizedValue = normalizeCategoryValue(value);

  if (!normalizedValue) {
    return null;
  }

  return MENU_CATEGORIES.find((category) => {
    if (normalizeCategoryValue(category.value) === normalizedValue) {
      return true;
    }

    return (category.aliases || []).some((alias) => normalizeCategoryValue(alias) === normalizedValue);
  }) ?? null;
};
