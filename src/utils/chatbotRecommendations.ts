import type { Dish, GuestDishIndexEntry } from '../types';

export interface ChatRecommendationDish {
  id: number;
  name: string;
  nameAr?: string | null;
  category?: string;
  categoryAr?: string | null;
  imageUrl?: string;
  isProfitable?: boolean;
  isOrderable?: boolean;
  isOutOfStock?: boolean;
  suggestedDishIds: number[];
  relatedDishIds: number[];
  relationsLoaded: boolean;
}

export interface ChatRecommendationResolution {
  type: 'none' | 'direct' | 'category' | 'global';
  category?: string | null;
  matchedDishId?: number;
  dishes: ChatRecommendationDish[];
}

const DIRECT_DISH_INTENT_PATTERN = /(\?|(?:^|\b)(about|tell me about|what is|what's|how is|how's|do you have|have|with|without|contains?|come(?:s)? with|price|cost|spicy|good|popular|recommend|suggest|pair|pairing|go(?:es)? with|similar to|like|details?|info(?:rmation)?)(?:\b|$)|شو|ايش|ما هي|ماهو|قديش|هل|avec|sans|contient|prix|recommande|parle[- ]moi|qu'est-ce)/i;
const RECOMMENDATION_INTENT_PATTERN = /(\brecommend\b|\bsuggest\b|\bbest\b|\bpopular\b|\btop\b|\bpairing\b|\bwhat should i order\b|\bwhat do you recommend\b|\bchef'?s pick\b|رشح|اقترح|شو بتنصح|شو أطلب|شو الاقوى|recommande|suggestion|qu'est-ce que tu recommandes|que recommandes-tu)/i;
const EXPLICIT_RECOMMENDATION_PATTERN = /(\brecommend\b|\bsuggest\b|\bhonest pick\b|\bstart with\b|\bgo with\b|\bsafe choice\b|\bstrong pick\b|\bsolid place to start\b|\bbest pick\b|\bmy pick\b|\btry\b|ارشح|بنصح|اقترح|أنصح|recommande|je choisirais)/i;

export const normalizeDishName = (value: string): string => value.trim().toLowerCase();
export const normalizeCategoryText = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, ' ');

const singularizeCategoryText = (value: string): string => {
  if (value.endsWith('ies') && value.length > 3) {
    return `${value.slice(0, -3)}y`;
  }
  if (value.endsWith('es') && value.length > 2) {
    return value.slice(0, -2);
  }
  if (value.endsWith('s') && value.length > 1) {
    return value.slice(0, -1);
  }
  return value;
};

const uniqueIds = (values: Array<number | null | undefined>): number[] => {
  const seen = new Set<number>();
  const next: number[] = [];

  values.forEach((value) => {
    if (!Number.isFinite(value) || value === null || value === undefined) {
      return;
    }

    const id = Number(value);
    if (seen.has(id)) {
      return;
    }

    seen.add(id);
    next.push(id);
  });

  return next;
};

const buildDishAliases = (dish: Pick<ChatRecommendationDish, 'name' | 'nameAr'>): string[] => (
  [dish.name, dish.nameAr]
    .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    .map((value) => normalizeDishName(value))
);

const isOrderableDish = (dish: Pick<ChatRecommendationDish, 'isOrderable' | 'isOutOfStock'>): boolean => (
  dish.isOrderable !== false && dish.isOutOfStock !== true
);

export const isRecommendationIntent = (text: string): boolean => {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return RECOMMENDATION_INTENT_PATTERN.test(normalized);
};

export const isDirectDishIntent = (text: string): boolean => {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return DIRECT_DISH_INTENT_PATTERN.test(normalized);
};

export const responseExplicitlyRecommendsDishName = (
  text: string,
  dishName: string | null | undefined
): boolean => {
  if (!dishName) {
    return false;
  }

  const normalizedDishName = normalizeDishName(dishName);
  const loweredText = text.toLowerCase();
  if (normalizedDishName === '' || !loweredText.includes(normalizedDishName)) {
    return false;
  }

  return EXPLICIT_RECOMMENDATION_PATTERN.test(text);
};

export const sortRecommendationDishesByPriority = (dishes: ChatRecommendationDish[]): ChatRecommendationDish[] => (
  [...dishes].sort((left, right) => {
    const leftAvailableScore = isOrderableDish(left) ? 1 : 0;
    const rightAvailableScore = isOrderableDish(right) ? 1 : 0;

    if (leftAvailableScore !== rightAvailableScore) {
      return rightAvailableScore - leftAvailableScore;
    }

    const leftProfitScore = left.isProfitable === true ? 1 : 0;
    const rightProfitScore = right.isProfitable === true ? 1 : 0;

    if (leftProfitScore !== rightProfitScore) {
      return rightProfitScore - leftProfitScore;
    }

    return left.name.localeCompare(right.name);
  })
);

const takePreferredPool = (dishes: ChatRecommendationDish[]): ChatRecommendationDish[] => {
  const available = dishes.filter((dish) => isOrderableDish(dish));
  const profitable = available.filter((dish) => dish.isProfitable === true);
  const prioritized = profitable.length > 0 ? profitable : available;
  return sortRecommendationDishesByPriority(prioritized).slice(0, 3);
};

export const toChatRecommendationDish = (dish: Dish): ChatRecommendationDish => ({
  id: dish.id,
  name: dish.name,
  nameAr: dish.name_ar ?? null,
  category: dish.category,
  categoryAr: dish.category_ar ?? null,
  imageUrl: dish.image_url ?? undefined,
  isProfitable: dish.is_profitable === true,
  isOrderable: dish.is_orderable,
  isOutOfStock: dish.is_out_of_stock,
  suggestedDishIds: uniqueIds((dish.suggested_dishes || []).map((candidate) => candidate.id)),
  relatedDishIds: uniqueIds((dish.related_dishes || []).map((candidate) => candidate.id)),
  relationsLoaded: Array.isArray(dish.suggested_dishes) || Array.isArray(dish.related_dishes),
});

export const toChatRecommendationDishFromIndex = (dish: GuestDishIndexEntry): ChatRecommendationDish => ({
  id: dish.id,
  name: dish.name,
  nameAr: dish.name_ar ?? null,
  category: dish.category,
  categoryAr: dish.category_ar ?? null,
  imageUrl: dish.image_url ?? undefined,
  isProfitable: dish.is_profitable === true,
  isOrderable: dish.is_orderable,
  isOutOfStock: dish.is_out_of_stock,
  suggestedDishIds: [],
  relatedDishIds: [],
  relationsLoaded: false,
});

export const mergeRecommendationDishes = (
  current: ChatRecommendationDish[],
  incoming: ChatRecommendationDish[]
): ChatRecommendationDish[] => {
  const map = new Map<number, ChatRecommendationDish>();

  current.forEach((dish) => {
    map.set(dish.id, dish);
  });

  incoming.forEach((dish) => {
    const existing = map.get(dish.id);
    if (!existing) {
      map.set(dish.id, dish);
      return;
    }

    map.set(dish.id, {
      ...existing,
      ...dish,
      name: dish.name || existing.name,
      nameAr: dish.nameAr ?? existing.nameAr ?? null,
      category: dish.category || existing.category,
      categoryAr: dish.categoryAr ?? existing.categoryAr ?? null,
      imageUrl: dish.imageUrl ?? existing.imageUrl,
      isProfitable: dish.isProfitable ?? existing.isProfitable,
      isOrderable: dish.isOrderable ?? existing.isOrderable,
      isOutOfStock: dish.isOutOfStock ?? existing.isOutOfStock,
      suggestedDishIds: uniqueIds([...existing.suggestedDishIds, ...dish.suggestedDishIds]),
      relatedDishIds: uniqueIds([...existing.relatedDishIds, ...dish.relatedDishIds]),
      relationsLoaded: existing.relationsLoaded || dish.relationsLoaded,
    });
  });

  return sortRecommendationDishesByPriority(Array.from(map.values()));
};

export const collectRecommendationDishesFromFullMenu = (dishes: Dish[]): ChatRecommendationDish[] => {
  const flattened: ChatRecommendationDish[] = [];

  dishes.forEach((dish) => {
    flattened.push(toChatRecommendationDish(dish));
    (dish.suggested_dishes || []).forEach((candidate) => {
      flattened.push(toChatRecommendationDish(candidate));
    });
    (dish.related_dishes || []).forEach((candidate) => {
      flattened.push(toChatRecommendationDish(candidate));
    });
  });

  return mergeRecommendationDishes([], flattened);
};

export const buildDishAliasLinks = (dishes: ChatRecommendationDish[]): Array<{
  id: number;
  name: string;
  normalized: string;
  imageUrl?: string;
  isProfitable?: boolean;
  isOrderable?: boolean;
  isOutOfStock?: boolean;
  category?: string;
  categoryAr?: string | null;
}> => {
  const dedupe = new Map<string, {
    id: number;
    name: string;
    normalized: string;
    imageUrl?: string;
    isProfitable?: boolean;
    isOrderable?: boolean;
    isOutOfStock?: boolean;
    category?: string;
    categoryAr?: string | null;
  }>();
  const sortLinks = (links: Array<{
    id: number;
    name: string;
    normalized: string;
    imageUrl?: string;
    isProfitable?: boolean;
    isOrderable?: boolean;
    isOutOfStock?: boolean;
    category?: string;
    categoryAr?: string | null;
  }>) => [...links].sort((left, right) => {
    const leftAvailableScore = left.isOrderable !== false && left.isOutOfStock !== true ? 1 : 0;
    const rightAvailableScore = right.isOrderable !== false && right.isOutOfStock !== true ? 1 : 0;

    if (leftAvailableScore !== rightAvailableScore) {
      return rightAvailableScore - leftAvailableScore;
    }

    const leftProfitScore = left.isProfitable === true ? 1 : 0;
    const rightProfitScore = right.isProfitable === true ? 1 : 0;

    if (leftProfitScore !== rightProfitScore) {
      return rightProfitScore - leftProfitScore;
    }

    return left.name.localeCompare(right.name);
  });

  dishes.forEach((dish) => {
    buildDishAliases(dish).forEach((alias) => {
      if (!alias || dedupe.has(alias)) {
        return;
      }

      const label = alias === normalizeDishName(dish.nameAr || '') && dish.nameAr
        ? dish.nameAr.trim()
        : dish.name.trim();

      dedupe.set(alias, {
        id: dish.id,
        name: label,
        normalized: alias,
        imageUrl: dish.imageUrl,
        isProfitable: dish.isProfitable,
        isOrderable: dish.isOrderable,
        isOutOfStock: dish.isOutOfStock,
        category: dish.category,
        categoryAr: dish.categoryAr ?? null,
      });
    });
  });

  return sortLinks(Array.from(dedupe.values()));
};

type CategoryBucket = { label: string; dishes: ChatRecommendationDish[]; aliases: Set<string> };

const buildCategoryAliases = (label: string): string[] => {
  const normalizedLabel = normalizeCategoryText(label);
  if (!normalizedLabel) {
    return [];
  }

  const aliases = new Set<string>();
  aliases.add(normalizedLabel);
  aliases.add(singularizeCategoryText(normalizedLabel));

  const words = normalizedLabel.split(' ').filter(Boolean);
  if (words.length > 1) {
    const lastWord = words[words.length - 1];
    aliases.add(lastWord);
    aliases.add(singularizeCategoryText(lastWord));
  }

  return Array.from(aliases);
};

export const getCategorySuggestionPool = (
  text: string,
  dishes: ChatRecommendationDish[]
): { category: string; dishes: ChatRecommendationDish[] } | null => {
  const normalizedText = normalizeCategoryText(text);
  if (!normalizedText) {
    return null;
  }

  const availableDishes = dishes.filter((dish) => isOrderableDish(dish));
  const categoryBuckets = new Map<string, CategoryBucket>();

  availableDishes.forEach((dish) => {
    const rawLabels = [dish.category, dish.categoryAr]
      .filter((value): value is string => typeof value === 'string' && value.trim() !== '');

    if (rawLabels.length === 0) {
      return;
    }

    const key = normalizeCategoryText(rawLabels[0]);
    const existing = categoryBuckets.get(key) ?? {
      label: rawLabels[0].trim(),
      dishes: [],
      aliases: new Set<string>(),
    };

    rawLabels.forEach((label) => {
      buildCategoryAliases(label).forEach((alias) => {
        if (alias) {
          existing.aliases.add(alias);
        }
      });
    });

    existing.dishes.push(dish);
    categoryBuckets.set(key, existing);
  });

  const matchingBuckets: Array<{ bucket: CategoryBucket; score: number }> = [];

  for (const entry of categoryBuckets.values()) {
    const matchedAliases = Array.from(entry.aliases).filter((alias) => alias !== '' && normalizedText.includes(alias));
    if (matchedAliases.length === 0) {
      continue;
    }

    const score = matchedAliases.reduce((best, alias) => Math.max(best, alias.length), 0);
    matchingBuckets.push({ bucket: entry, score });
  }

  if (matchingBuckets.length === 0) {
    return null;
  }

  const highestScore = matchingBuckets.reduce((best, entry) => Math.max(best, entry.score), 0);
  const selectedBuckets = matchingBuckets
    .filter((entry) => entry.score === highestScore)
    .map((entry) => entry.bucket);
  const combinedDishes = selectedBuckets.flatMap((entry) => entry.dishes);

  return {
    category: selectedBuckets.length === 1
      ? selectedBuckets[0].label
      : normalizedText.includes('pizza')
        ? 'Pizza'
        : selectedBuckets[0].label,
    dishes: takePreferredPool(combinedDishes),
  };
};

export const findMentionedDish = (
  text: string,
  dishes: ChatRecommendationDish[]
): ChatRecommendationDish | null => {
  const loweredText = text.toLowerCase();
  if (!loweredText.trim()) {
    return null;
  }

  let bestDish: ChatRecommendationDish | null = null;
  let bestStart = Number.POSITIVE_INFINITY;
  let bestLength = -1;

  dishes.forEach((dish) => {
    buildDishAliases(dish).forEach((alias) => {
      const start = loweredText.indexOf(alias);
      if (start < 0) {
        return;
      }

      if (
        !bestDish
        || start < bestStart
        || (start === bestStart && alias.length > bestLength)
      ) {
        bestDish = dish;
        bestStart = start;
        bestLength = alias.length;
      }
    });
  });

  return bestDish;
};

const getSameCategoryPool = (
  sourceDish: ChatRecommendationDish,
  dishes: ChatRecommendationDish[]
): ChatRecommendationDish[] => dishes.filter((candidate) => {
  if (candidate.id === sourceDish.id || !isOrderableDish(candidate)) {
    return false;
  }

  return candidate.category === sourceDish.category
    || (
      Boolean(sourceDish.categoryAr)
      && Boolean(candidate.categoryAr)
      && candidate.categoryAr === sourceDish.categoryAr
    );
});

const getDirectSuggestionPool = (
  sourceDish: ChatRecommendationDish,
  dishes: ChatRecommendationDish[]
): ChatRecommendationDish[] => {
  const catalog = new Map<number, ChatRecommendationDish>();
  dishes.forEach((dish) => {
    catalog.set(dish.id, dish);
  });

  const relatedIds = uniqueIds([
    ...sourceDish.suggestedDishIds,
    ...sourceDish.relatedDishIds,
  ]).filter((id) => id !== sourceDish.id);

  const relatedPool = relatedIds
    .map((id) => catalog.get(id) ?? null)
    .filter((dish): dish is ChatRecommendationDish => {
      if (!dish) {
        return false;
      }

      return isOrderableDish(dish);
    });

  const preferredRelated = takePreferredPool(relatedPool);
  if (preferredRelated.length > 0) {
    return preferredRelated;
  }

  return takePreferredPool(getSameCategoryPool(sourceDish, dishes));
};

export const resolveChatRecommendation = (
  text: string,
  dishes: ChatRecommendationDish[],
  options?: { detailedDish?: ChatRecommendationDish | null }
): ChatRecommendationResolution => {
  if (dishes.length === 0) {
    return { type: 'none', dishes: [] };
  }

  const matchedDish = findMentionedDish(text, dishes);
  const recommendationIntent = isRecommendationIntent(text);
  const categorySuggestion = getCategorySuggestionPool(text, dishes);

  if (matchedDish && isDirectDishIntent(text)) {
    const sourceDish = options?.detailedDish && options.detailedDish.id === matchedDish.id
      ? options.detailedDish
      : matchedDish;
    return {
      type: 'direct',
      matchedDishId: sourceDish.id,
      category: sourceDish.category ?? sourceDish.categoryAr ?? null,
      dishes: getDirectSuggestionPool(sourceDish, mergeRecommendationDishes(dishes, sourceDish ? [sourceDish] : [])),
    };
  }

  if (categorySuggestion) {
    return {
      type: 'category',
      category: categorySuggestion.category,
      dishes: categorySuggestion.dishes,
    };
  }

  if (recommendationIntent) {
    return {
      type: 'global',
      dishes: takePreferredPool(dishes),
    };
  }

  return { type: 'none', dishes: [] };
};
