import api from './api';

export interface DishDescriptionGenerationIngredient {
  ingredient_id: number;
  ingredient_name: string;
  quantity_required: number;
  unit: string;
  order_index: number;
}

export interface GenerateDishDescriptionRequest {
  name: string;
  category: string;
  calories?: number;
  recipe_ingredients: DishDescriptionGenerationIngredient[];
  target_languages: Array<'en' | 'ar'>;
}

export interface GenerateDishDescriptionResponse {
  description: string;
  description_ar?: string | null;
}

export const generateDishDescription = async (
  payload: GenerateDishDescriptionRequest
): Promise<GenerateDishDescriptionResponse> => {
  const response = await api.post<GenerateDishDescriptionResponse>('/admin/dishes/generate-description', payload);
  return response.data;
};
