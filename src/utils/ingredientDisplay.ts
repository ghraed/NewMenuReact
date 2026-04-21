import type { DishRecipeIngredient } from '../types';
import { translateIngredientLabel } from '../i18n/ingredients';

interface IngredientNameSource {
  name?: string | null;
  name_ar?: string | null;
}

export const getIngredientDisplayName = (
  source?: IngredientNameSource | null,
  language?: string
): string => {
  const name = source?.name ?? '';
  const nameArabic = source?.name_ar ?? null;

  return translateIngredientLabel(name, language, nameArabic);
};

export const getRecipeIngredientDisplayName = (
  row?: DishRecipeIngredient | null,
  language?: string
): string => getIngredientDisplayName(row?.ingredient, language);

