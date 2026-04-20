import api from './api';
import type { IngredientLibraryItem } from '../types';

export type IngredientImageStatus = 'exists' | 'missing' | 'generating' | 'failed';

export interface IngredientLibraryRecord extends IngredientLibraryItem {
  category?: string | null;
  image_url?: string | null;
  image_status?: IngredientImageStatus;
}

interface IngredientListResponse {
  data?: IngredientLibraryRecord[];
  ingredients?: IngredientLibraryRecord[];
}

const normalizeItem = (item: IngredientLibraryRecord): IngredientLibraryRecord => {
  const imageUrl = item.image_url ?? item.file_url ?? null;
  const status: IngredientImageStatus = item.image_status
    ?? (imageUrl ? 'exists' : 'missing');

  return {
    ...item,
    image_url: imageUrl,
    image_status: status,
  };
};

export const listIngredientLibrary = async (): Promise<IngredientLibraryRecord[]> => {
  const response = await api.get<IngredientLibraryRecord[] | IngredientListResponse>('/ingredients');
  const payload = response.data;
  const raw = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.ingredients)
      ? payload.ingredients
      : Array.isArray(payload?.data)
        ? payload.data
        : [];

  return raw.map(normalizeItem);
};

export const createIngredientLibraryItem = async (
  payload: Pick<IngredientLibraryRecord, 'name' | 'category'>
): Promise<IngredientLibraryRecord> => {
  const response = await api.post<IngredientLibraryRecord>('/ingredients', payload);
  return normalizeItem(response.data);
};

export const updateIngredientLibraryItem = async (
  ingredientId: number,
  payload: Partial<Pick<IngredientLibraryRecord, 'name' | 'category'>>
): Promise<IngredientLibraryRecord> => {
  const response = await api.patch<IngredientLibraryRecord>(`/ingredients/${ingredientId}`, payload);
  return normalizeItem(response.data);
};

export const deleteIngredientLibraryItem = async (ingredientId: number): Promise<void> => {
  await api.delete(`/ingredients/${ingredientId}`);
};

export const generateIngredientImage = async (ingredientId: number): Promise<IngredientLibraryRecord> => {
  const response = await api.post<IngredientLibraryRecord>(`/ingredients/${ingredientId}/generate-image`);
  return normalizeItem(response.data);
};

export const generateMissingIngredientImages = async (): Promise<void> => {
  await api.post('/ingredients/generate-missing-images');
};

