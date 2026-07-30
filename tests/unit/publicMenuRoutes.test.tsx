import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AppLocaleSync from '../../src/components/AppLocaleSync';
import LanguageToggle from '../../src/components/LanguageToggle';
import GuestDishListPage from '../../src/pages/GuestDishListPage';
import GuestDishPage from '../../src/pages/GuestDishPage';
import i18n from '../../src/i18n';
import type { Dish, GuestDishIndexEntry, RestaurantSummary } from '../../src/types';

const mockedOrderCart = vi.hoisted(() => ({
  useOrderCart: vi.fn(),
}));

const mockedGuestMenuResource = vi.hoisted(() => ({
  useGuestMenuResource: vi.fn(),
}));

const mockedApi = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('../../src/contexts/useOrderCart', () => ({
  useOrderCart: mockedOrderCart.useOrderCart,
}));

vi.mock('../../src/contexts/GuestMenuResourceContext', () => ({
  useGuestMenuResource: mockedGuestMenuResource.useGuestMenuResource,
}));

vi.mock('../../src/services/api', () => ({
  default: {
    get: mockedApi.get,
  },
}));

vi.mock('../../src/components/Guest/GuestPageShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../src/components/Guest/GuestInfoSection', () => ({
  default: () => null,
}));

vi.mock('../../src/components/Guest/GuestTableAccessPanel', () => ({
  default: () => null,
}));

vi.mock('../../src/components/Common/RestaurantBrandMark', () => ({
  default: ({ name }: { name: string }) => <div data-testid="restaurant-brand">{name.slice(0, 1)}</div>,
}));

vi.mock('../../src/components/Common/LoadingSpinner', () => ({
  default: ({ text }: { text?: string }) => <div>{text ?? 'Loading...'}</div>,
}));

vi.mock('../../src/components/Common/DishAssetThumbnail', () => ({
  default: () => <div data-testid="dish-asset-thumbnail" />,
}));

vi.mock('../../src/components/Guest/SectionHeading', () => ({
  default: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock('../../src/components/Guest/DishTags', () => ({
  default: ({
    tags,
    activeTag,
    onTagClick,
  }: {
    tags: string[];
    activeTag: string;
    onTagClick: (tag: string) => void;
  }) => (
    <div>
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          aria-pressed={activeTag === tag}
          onClick={() => onTagClick(tag)}
        >
          {tag}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('../../src/components/Guest/DishCard', async () => {
  const { useTranslation } = await import('react-i18next');
  const MockDishCard = ({
    dish,
    onOpen,
  }: {
    dish: Dish;
    onOpen?: () => void;
  }) => {
    const { i18n, t } = useTranslation();
    const isArabic = i18n.resolvedLanguage === 'ar';
    const name = isArabic ? (dish.name_ar || dish.name) : dish.name;

    return (
      <article data-testid={`dish-card-${dish.id}`}>
        <h2>{name}</h2>
        {onOpen ? (
          <button type="button" onClick={onOpen}>
            {t('dishCard.viewDetails')}
          </button>
        ) : null}
      </article>
    );
  };

  return {
    default: MockDishCard,
  };
});

vi.mock('../../src/components/Guest/DishDetailView', async () => {
  const { useTranslation } = await import('react-i18next');
  const MockDishDetailView = ({ dish }: { dish: Dish }) => {
    const { i18n } = useTranslation();
    const isArabic = i18n.resolvedLanguage === 'ar';

    return (
      <article>
        <h1>{isArabic ? (dish.name_ar || dish.name) : dish.name}</h1>
        <p>{isArabic ? (dish.description_ar || dish.description) : dish.description}</p>
      </article>
    );
  };

  return {
    default: MockDishDetailView,
  };
});

const restaurantPayload: RestaurantSummary = {
  id: 10,
  name: 'Demo Bistro',
  slug: 'demo-bistro',
  logo_url: null,
  currency: 'USD',
  other_currency: 'LBP',
  dollar_rate: 89_500,
  profile: {
    short_description: 'Seasonal dishes for mobile and desktop guests.',
  },
  feature_flags: {
    ai_recommendations: true,
    table_ordering: true,
    multi_language: true,
  },
};

const createDish = (overrides: Partial<Dish>): Dish => ({
  id: 1,
  uuid: 'dish-1',
  name: 'Featured Mezze',
  name_ar: 'مقبلات مميزة',
  description: 'A bright cold starter.',
  description_ar: 'مقبلات باردة ومنعشة.',
  price: 8.5,
  currency: 'USD',
  category: 'Appetizers',
  category_ar: 'مقبلات',
  status: 'published',
  item_type: 'prepared_dish',
  is_anchor: false,
  is_profitable: false,
  is_orderable: true,
  is_out_of_stock: false,
  image_url: undefined,
  assets: [],
  dish_ingredients: [],
  suggested_dishes: [],
  related_dishes: [],
  created_at: '2026-07-26T12:00:00.000Z',
  updated_at: '2026-07-26T12:00:00.000Z',
  ...overrides,
});

const featuredDish = createDish({
  id: 1,
  uuid: 'dish-1',
  name: 'Featured Mezze',
  name_ar: 'مقبلات مميزة',
  category: 'Appetizers',
  category_ar: 'مقبلات',
  is_anchor: true,
  is_profitable: true,
});

const burgerDish = createDish({
  id: 2,
  uuid: 'dish-2',
  name: 'Halloumi Burger',
  name_ar: 'برغر حلوم',
  description: 'Charred halloumi, herb aioli, and pickles.',
  description_ar: 'حلوم مشوي مع أيولي الأعشاب والمخلل.',
  price: 14,
  category: 'Main Courses',
  category_ar: 'الأطباق الرئيسية',
  is_profitable: true,
});

const baklavaDish = createDish({
  id: 3,
  uuid: 'dish-3',
  name: 'Baklava',
  name_ar: 'بقلاوة',
  description: 'Crisp pastry with pistachio syrup.',
  description_ar: 'رقائق مقرمشة مع شراب الفستق.',
  price: 6,
  category: 'Desserts',
  category_ar: 'حلويات',
});

const indexEntry = (dish: Dish): GuestDishIndexEntry => ({
  id: dish.id,
  uuid: dish.uuid,
  name: dish.name,
  name_ar: dish.name_ar ?? null,
  description: dish.description,
  description_ar: dish.description_ar ?? null,
  category: dish.category,
  category_ar: dish.category_ar ?? null,
  is_anchor: dish.is_anchor,
  is_profitable: dish.is_profitable,
  is_orderable: dish.is_orderable,
  is_out_of_stock: dish.is_out_of_stock,
  image_url: dish.image_url ?? null,
  ingredients: [],
});

const menuPayload = {
  restaurant: restaurantPayload,
  dish_index: [indexEntry(featuredDish), indexEntry(burgerDish), indexEntry(baklavaDish)],
  dishes: [featuredDish, burgerDish, baklavaDish],
  dishes_page: [featuredDish, burgerDish, baklavaDish],
  dishes_meta: {
    total: 3,
    limit: 20,
    offset: 0,
    has_more: false,
    next_offset: null,
  },
};

const directDishPayload = {
  ...burgerDish,
  restaurant: restaurantPayload,
};

const emptyMenuPayload = {
  restaurant: {
    ...restaurantPayload,
    slug: 'empty-bistro',
    name: 'Empty Bistro',
  },
  dish_index: [],
  dishes: [],
  dishes_page: [],
  dishes_meta: {
    total: 0,
    limit: 20,
    offset: 0,
    has_more: false,
    next_offset: null,
  },
};

const renderPublicMenu = async (initialEntry: string) => {
  await act(async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <AppLocaleSync />
          <LanguageToggle />
          <Routes>
            <Route path="/menu/:restaurant_slug" element={<GuestDishListPage />} />
            <Route path="/menu/:restaurant_slug/dish/:dish_id" element={<GuestDishPage />} />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>
    );

    await Promise.resolve();
  });
};

describe('Public menu routes', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    window.localStorage.clear();
    await act(async () => {
      await i18n.changeLanguage('en');
    });
    document.documentElement.dir = 'ltr';
    document.body.dir = 'ltr';

    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockedOrderCart.useOrderCart.mockReturnValue({
      addDish: vi.fn(),
      updateQuantity: vi.fn(),
      draft: {
        tableId: null,
        tableSessionId: null,
        tableReference: '',
        guestAccessToken: null,
        guestAccessVerified: false,
        guestAccessExpiresAt: null,
        notes: '',
      },
      restaurant: null,
      getDishQuantity: vi.fn(() => 0),
      setGuestContext: vi.fn(),
      setGuestAccess: vi.fn(),
      updateDraft: vi.fn(),
      clearGuestAccess: vi.fn(),
    });

    mockedGuestMenuResource.useGuestMenuResource.mockImplementation((query: { restaurantSlug?: string | null; language?: string | null }) => {
      const isEmpty = query.restaurantSlug === 'empty-bistro';

      return {
        enabled: true,
        key: `${query.restaurantSlug ?? 'menu'}:${query.language ?? 'en'}`,
        ensure: vi.fn().mockResolvedValue(null),
        data: isEmpty ? emptyMenuPayload : menuPayload,
        error: null,
        isOfflineData: false,
        sessionEligible: true,
        lastLoadedAt: null,
      };
    });

    mockedApi.get.mockImplementation((url: string) => {
      if (url.includes('/menu/demo-bistro/dish/')) {
        return Promise.resolve({ data: directDishPayload });
      }

      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
  });

  afterEach(async () => {
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
    await act(async () => {
      await i18n.changeLanguage('en');
    });
  });

  it('filters the public menu and switches between LTR and RTL without console errors', async () => {
    const user = userEvent.setup();

    await renderPublicMenu('/menu/demo-bistro');

    await screen.findByText('Demo Bistro');
    expect(await screen.findByText('Featured Mezze')).toBeInTheDocument();
    expect(screen.getByText('Halloumi Burger')).toBeInTheDocument();
    expect(screen.getByText('Baklava')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Search dishes...'), 'burger');

    await waitFor(() => {
      expect(screen.getByText('Halloumi Burger')).toBeInTheDocument();
      expect(screen.queryByText('Baklava')).not.toBeInTheDocument();
    });

    await user.clear(screen.getByPlaceholderText('Search dishes...'));
    await user.click(screen.getByRole('button', { name: 'Desserts' }));

    await waitFor(() => {
      expect(screen.getByText('Baklava')).toBeInTheDocument();
      expect(screen.queryByText('Halloumi Burger')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Language: AR' }));

    await waitFor(() => {
      expect(document.documentElement.dir).toBe('rtl');
      expect(screen.getByPlaceholderText('ابحث عن الأطباق...')).toBeInTheDocument();
      expect(screen.getByText('بقلاوة')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'اللغة: EN' }));

    await waitFor(() => {
      expect(document.documentElement.dir).toBe('ltr');
      expect(screen.getByPlaceholderText('Search dishes...')).toBeInTheDocument();
    });
  });

  it('supports direct dish URLs with Arabic and English content', async () => {
    const user = userEvent.setup();

    await renderPublicMenu('/menu/demo-bistro/dish/halloumi-burger-2');

    await screen.findByText('Halloumi Burger');
    expect(screen.getByText('Charred halloumi, herb aioli, and pickles.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Language: AR' }));

    await waitFor(() => {
      expect(document.documentElement.dir).toBe('rtl');
      expect(screen.getByText('برغر حلوم')).toBeInTheDocument();
      expect(screen.getByText('حلوم مشوي مع أيولي الأعشاب والمخلل.')).toBeInTheDocument();
    });
  });

  it('shows the empty-menu state without console errors', async () => {
    await renderPublicMenu('/menu/empty-bistro');

    await screen.findByText('Empty Bistro');
    expect(screen.getByText('No dishes found for your filter.')).toBeInTheDocument();
  });
});
