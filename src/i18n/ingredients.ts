import { normalizeLanguage, type AppLanguage } from './language';

const normalizeIngredientKey = (value?: string | null): string => (
  (value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
);

const ingredientTranslations: Record<string, string> = {
  'pizza dough': 'عجينة بيتزا',
  'tomato sauce': 'صلصة طماطم',
  mozzarella: 'موزاريلا',
  'fresh basil': 'ريحان طازج',
  'olive oil': 'زيت زيتون',
  pepperoni: 'بيبروني',
  oregano: 'أوريغانو',
  mushrooms: 'فطر',
  'bell peppers': 'فليفلة حلوة',
  olives: 'زيتون',
  'red onions': 'بصل أحمر',
  parmesan: 'بارميزان',
  gorgonzola: 'غورغونزولا',
  cheddar: 'شيدر',
  'bbq sauce': 'صلصة باربكيو',
  'grilled chicken': 'دجاج مشوي',
  cilantro: 'كزبرة',
  'buffalo sauce': 'صلصة بافلو',
  chicken: 'دجاج',
  'ranch drizzle': 'صلصة رانش',
  'cream sauce': 'صلصة كريمية',
  'truffle oil': 'زيت الكمأة',
  sausage: 'نقانق',
  'beef bacon': 'بيف بيكون',
  'beef patty': 'قطعة لحم بقري',
  'burger bun': 'خبز برغر',
  lettuce: 'خس',
  tomato: 'طماطم',
  pickles: 'مخلل',
  'burger sauce': 'صلصة برغر',
  'swiss cheese': 'جبنة سويسرية',
  'caramelized onions': 'بصل مكرمل',
  mayonnaise: 'مايونيز',
  jalapenos: 'هالبينو',
  'pepper jack cheese': 'جبنة بيبر جاك',
  'spicy mayo': 'مايونيز حار',
  'fried chicken fillet': 'فيليه دجاج مقرمش',
  'garlic mayo': 'مايونيز بالثوم',
  'ciabatta bread': 'خبز تشاباتا',
  'garlic aioli': 'آيولي بالثوم',
  turkey: 'ديك رومي',
  'toast bread': 'خبز توست',
  'beef strips': 'شرائح لحم بقري',
  'hoagie roll': 'خبز هوجي',
  onions: 'بصل',
  provolone: 'بروفولون',
  tuna: 'تونة',
  fettuccine: 'فيتوتشيني',
  cream: 'كريمة',
  garlic: 'ثوم',
  butter: 'زبدة',
  spaghetti: 'سباغيتي',
  'ground beef': 'لحم بقري مفروم',
  penne: 'بيني',
  'basil pesto': 'بيستو ريحان',
  'cherry tomatoes': 'طماطم كرزية',
  shrimp: 'روبيان',
  'chili flakes': 'رقائق فلفل حار',
  parsley: 'بقدونس',
  'romaine lettuce': 'خس روماني',
  croutons: 'خبز محمص',
  'caesar dressing': 'صلصة سيزر',
  cucumber: 'خيار',
  feta: 'فيتا',
  'mixed greens': 'خضار ورقية مشكلة',
  corn: 'ذرة',
  vinaigrette: 'صلصة فينيغريت',
  quinoa: 'كينوا',
  avocado: 'أفوكادو',
  'lemon dressing': 'صلصة ليمون',
  breadcrumbs: 'بقسماط',
  eggs: 'بيض',
  flour: 'طحين',
  'marinara sauce': 'صلصة مارينارا',
  'chicken wings': 'أجنحة دجاج',
  'tortilla chips': 'رقائق تورتيلا',
  salsa: 'سالسا',
  guacamole: 'غواكامولي',
  'sour cream': 'كريمة حامضة',
  baguette: 'باغيت',
  'garlic butter': 'زبدة بالثوم',
  potatoes: 'بطاطا',
  ketchup: 'كاتشب',
  'cheese sauce': 'صلصة جبنة',
  'green onions': 'بصل أخضر',
  coleslaw: 'كولسلو',
  cabbage: 'ملفوف',
  carrots: 'جزر',
  'lava cake': 'كيكة لافا',
  chocolate: 'شوكولاتة',
  'vanilla ice cream': 'آيس كريم فانيلا',
  cheesecake: 'تشيزكيك',
  'cream cheese': 'جبنة كريمية',
  biscuits: 'بسكويت',
  tiramisu: 'تيراميسو',
  mascarpone: 'ماسكاربوني',
  coffee: 'قهوة',
  cocoa: 'كاكاو',
  brownie: 'براوني',
  'hot fudge': 'صلصة شوكولاتة ساخنة',
  lemon: 'ليمون',
  'lemon juice': 'عصير ليمون',
  mint: 'نعناع',
  'mint leaves': 'أوراق نعناع',
  'fresh mint leaves': 'أوراق نعناع طازجة',
  'sugar syrup': 'شراب سكر',
  'ice water': 'ماء مثلج',
  espresso: 'إسبريسو',
  milk: 'حليب',
  ice: 'ثلج',
  strawberries: 'فراولة',
  sugar: 'سكر',
  mango: 'مانجو',
  yogurt: 'زبادي',
  honey: 'عسل',
};

export const translateIngredientLabel = (value?: string | null, language?: string): string => {
  const fallback = (value || '').trim();

  if (!fallback) {
    return '';
  }

  const normalizedLanguage = normalizeLanguage(language);

  if (normalizedLanguage !== 'ar') {
    return fallback;
  }

  return ingredientTranslations[normalizeIngredientKey(fallback)] || fallback;
};

export const translateIngredientLabelForAppLanguage = (value?: string | null, language?: AppLanguage): string => (
  translateIngredientLabel(value, language)
);
