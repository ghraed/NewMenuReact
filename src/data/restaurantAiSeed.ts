import type { IngredientStockUnit } from '../types';

export type DishStatusSeed = 'draft' | 'published';

export type DishDietaryTag =
  | 'vegetarian'
  | 'vegan'
  | 'contains_meat'
  | 'contains_seafood'
  | 'spicy'
  | 'gluten_free_option'
  | 'kids_friendly';

export type DishAllergen =
  | 'gluten'
  | 'dairy'
  | 'sesame'
  | 'nuts'
  | 'egg'
  | 'fish'
  | 'shellfish';

export interface RestaurantAiProfile {
  name: string;
  name_ar: string;
  slug: string;
  cuisine: string[];
  city: string;
  country: string;
  timezone: string;
  currency: 'USD';
  vat_rate: number;
  service_model: 'casual_dining';
}

export interface RestaurantAiTable {
  name: string;
  seats: number;
  zone: 'indoor' | 'terrace';
}

export interface RestaurantAiInventoryIngredient {
  code: string;
  name: string;
  name_ar: string;
  unit: IngredientStockUnit;
  current_quantity: number;
  low_stock_threshold: number;
  supplier_note?: string;
}

export interface RestaurantAiRecipeIngredient {
  ingredient_code: string;
  quantity_required: number;
  prep_note?: string;
}

export interface RestaurantAiDish {
  code: string;
  name: string;
  name_ar: string;
  description: string;
  description_ar: string;
  category: string;
  category_ar: string;
  status: DishStatusSeed;
  price_usd: number;
  calories: number;
  prep_time_minutes: number;
  dietary_tags: DishDietaryTag[];
  allergens: DishAllergen[];
  spice_level: 0 | 1 | 2 | 3;
  recipe: RestaurantAiRecipeIngredient[];
  suggested_with: string[];
  related_dishes: string[];
  alternative_dishes: string[];
  ai_keywords: string[];
}

export interface RestaurantAiPolicies {
  allergy_notice: string;
  halal: boolean;
  alcohol_served: boolean;
  kitchen_close_time: string;
  average_ticket_usd: number;
}

export interface RestaurantAiKnowledgeBase {
  generated_at: string;
  profile: RestaurantAiProfile;
  tables: RestaurantAiTable[];
  policies: RestaurantAiPolicies;
  inventory: RestaurantAiInventoryIngredient[];
  dishes: RestaurantAiDish[];
}

const inventory: RestaurantAiInventoryIngredient[] = [
  { code: 'chickpeas', name: 'Chickpeas', name_ar: 'حمص', unit: 'g', current_quantity: 12000, low_stock_threshold: 2500 },
  { code: 'tahini', name: 'Tahini', name_ar: 'طحينة', unit: 'g', current_quantity: 7000, low_stock_threshold: 1200 },
  { code: 'olive-oil', name: 'Olive Oil', name_ar: 'زيت زيتون', unit: 'ml', current_quantity: 16000, low_stock_threshold: 3500 },
  { code: 'lemon-juice', name: 'Lemon Juice', name_ar: 'عصير ليمون', unit: 'ml', current_quantity: 9000, low_stock_threshold: 2000 },
  { code: 'garlic', name: 'Garlic', name_ar: 'ثوم', unit: 'g', current_quantity: 4200, low_stock_threshold: 900 },
  { code: 'parsley', name: 'Parsley', name_ar: 'بقدونس', unit: 'g', current_quantity: 2500, low_stock_threshold: 500 },
  { code: 'mint', name: 'Mint Leaves', name_ar: 'نعناع', unit: 'g', current_quantity: 1400, low_stock_threshold: 250 },
  { code: 'romaine', name: 'Romaine Lettuce', name_ar: 'خس روماني', unit: 'g', current_quantity: 6000, low_stock_threshold: 1200 },
  { code: 'tomato', name: 'Tomato', name_ar: 'بندورة', unit: 'g', current_quantity: 9000, low_stock_threshold: 1800 },
  { code: 'cucumber', name: 'Cucumber', name_ar: 'خيار', unit: 'g', current_quantity: 5500, low_stock_threshold: 1000 },
  { code: 'radish', name: 'Radish', name_ar: 'فجل', unit: 'g', current_quantity: 2200, low_stock_threshold: 450 },
  { code: 'sumac', name: 'Sumac', name_ar: 'سماق', unit: 'g', current_quantity: 1500, low_stock_threshold: 300 },
  { code: 'pomegranate-molasses', name: 'Pomegranate Molasses', name_ar: 'دبس رمان', unit: 'ml', current_quantity: 3200, low_stock_threshold: 650 },
  { code: 'halloumi', name: 'Halloumi Cheese', name_ar: 'جبنة حلوم', unit: 'g', current_quantity: 6500, low_stock_threshold: 1200 },
  { code: 'chicken-thigh', name: 'Chicken Thigh', name_ar: 'دجاج', unit: 'g', current_quantity: 18000, low_stock_threshold: 4000 },
  { code: 'kafta-mix', name: 'Kafta Meat Mix', name_ar: 'كفتة', unit: 'g', current_quantity: 14000, low_stock_threshold: 3000 },
  { code: 'lamb-chops', name: 'Lamb Chops', name_ar: 'ريش غنم', unit: 'g', current_quantity: 9000, low_stock_threshold: 2200 },
  { code: 'basmati-rice', name: 'Basmati Rice', name_ar: 'أرز بسمتي', unit: 'g', current_quantity: 24000, low_stock_threshold: 5000 },
  { code: 'white-fish', name: 'White Fish Fillet', name_ar: 'فيليه سمك أبيض', unit: 'g', current_quantity: 10500, low_stock_threshold: 2400 },
  { code: 'shrimp', name: 'Shrimp', name_ar: 'روبيان', unit: 'g', current_quantity: 7600, low_stock_threshold: 1700 },
  { code: 'arborio-rice', name: 'Arborio Rice', name_ar: 'أرز أربوريو', unit: 'g', current_quantity: 8000, low_stock_threshold: 1600 },
  { code: 'mushroom', name: 'Mushroom', name_ar: 'فطر', unit: 'g', current_quantity: 7200, low_stock_threshold: 1400 },
  { code: 'parmesan', name: 'Parmesan', name_ar: 'بارميزان', unit: 'g', current_quantity: 5000, low_stock_threshold: 900 },
  { code: 'pizza-dough', name: 'Pizza Dough Ball', name_ar: 'عجينة بيتزا', unit: 'piece', current_quantity: 110, low_stock_threshold: 25 },
  { code: 'mozzarella', name: 'Mozzarella', name_ar: 'موزاريلا', unit: 'g', current_quantity: 14000, low_stock_threshold: 3000 },
  { code: 'pizza-sauce', name: 'Pizza Sauce', name_ar: 'صلصة بيتزا', unit: 'g', current_quantity: 10000, low_stock_threshold: 1800 },
  { code: 'pepperoni', name: 'Pepperoni', name_ar: 'بيبروني', unit: 'g', current_quantity: 4800, low_stock_threshold: 900 },
  { code: 'basil', name: 'Fresh Basil', name_ar: 'ريحان طازج', unit: 'g', current_quantity: 1200, low_stock_threshold: 220 },
  { code: 'kunafa-dough', name: 'Kunafa Dough', name_ar: 'كنافة', unit: 'g', current_quantity: 4500, low_stock_threshold: 900 },
  { code: 'pistachio', name: 'Pistachio', name_ar: 'فستق', unit: 'g', current_quantity: 3200, low_stock_threshold: 700 },
  { code: 'orange-blossom-syrup', name: 'Orange Blossom Syrup', name_ar: 'قطر ماء الزهر', unit: 'ml', current_quantity: 2800, low_stock_threshold: 600 },
  { code: 'mascarpone', name: 'Mascarpone', name_ar: 'ماسكربوني', unit: 'g', current_quantity: 3400, low_stock_threshold: 700 },
  { code: 'ladyfingers', name: 'Ladyfinger Biscuits', name_ar: 'بسكويت ليدي فنغر', unit: 'g', current_quantity: 2900, low_stock_threshold: 550 },
  { code: 'espresso', name: 'Espresso', name_ar: 'إسبريسو', unit: 'ml', current_quantity: 6000, low_stock_threshold: 1200 },
  { code: 'sparkling-water', name: 'Sparkling Water', name_ar: 'مياه فوارة', unit: 'ml', current_quantity: 22000, low_stock_threshold: 4500 },
  { code: 'pomegranate-juice', name: 'Pomegranate Juice', name_ar: 'عصير رمان', unit: 'ml', current_quantity: 7500, low_stock_threshold: 1500 },
  { code: 'sugar-syrup', name: 'Sugar Syrup', name_ar: 'شراب سكري', unit: 'ml', current_quantity: 9000, low_stock_threshold: 1700 },
  { code: 'flatbread', name: 'Flatbread', name_ar: 'خبز عربي', unit: 'piece', current_quantity: 160, low_stock_threshold: 35 },
];

const dishes: RestaurantAiDish[] = [
  {
    code: 'hummus-trio',
    name: 'Hummus Trio',
    name_ar: 'حمص تريو',
    description: 'Classic hummus, beet hummus, and avocado hummus served with warm flatbread.',
    description_ar: 'ثلاث أنواع حمص: كلاسيك، شمندر، وأفوكادو مع خبز عربي ساخن.',
    category: 'Appetizers',
    category_ar: 'مقبلات',
    status: 'published',
    price_usd: 8.5,
    calories: 420,
    prep_time_minutes: 9,
    dietary_tags: ['vegetarian'],
    allergens: ['sesame', 'gluten'],
    spice_level: 0,
    recipe: [
      { ingredient_code: 'chickpeas', quantity_required: 160 },
      { ingredient_code: 'tahini', quantity_required: 35 },
      { ingredient_code: 'olive-oil', quantity_required: 15 },
      { ingredient_code: 'lemon-juice', quantity_required: 20 },
      { ingredient_code: 'garlic', quantity_required: 6 },
      { ingredient_code: 'flatbread', quantity_required: 1 },
    ],
    suggested_with: ['mint-lemonade', 'fattoush-signature'],
    related_dishes: ['grilled-halloumi', 'fattoush-signature'],
    alternative_dishes: ['grilled-halloumi'],
    ai_keywords: ['mezze', 'shareable', 'light starter', 'sesame'],
  },
  {
    code: 'fattoush-signature',
    name: 'Signature Fattoush',
    name_ar: 'فتوش سيغنتشر',
    description: 'Romaine, tomato, cucumber, radish, herbs, and pomegranate-sumac dressing.',
    description_ar: 'خس روماني، بندورة، خيار، فجل، أعشاب، وتتبيلة دبس الرمان والسماق.',
    category: 'Salads',
    category_ar: 'سلطات',
    status: 'published',
    price_usd: 7.5,
    calories: 240,
    prep_time_minutes: 7,
    dietary_tags: ['vegan'],
    allergens: ['gluten'],
    spice_level: 0,
    recipe: [
      { ingredient_code: 'romaine', quantity_required: 85 },
      { ingredient_code: 'tomato', quantity_required: 65 },
      { ingredient_code: 'cucumber', quantity_required: 60 },
      { ingredient_code: 'radish', quantity_required: 25 },
      { ingredient_code: 'parsley', quantity_required: 10 },
      { ingredient_code: 'sumac', quantity_required: 2 },
      { ingredient_code: 'pomegranate-molasses', quantity_required: 12 },
      { ingredient_code: 'olive-oil', quantity_required: 10 },
      { ingredient_code: 'flatbread', quantity_required: 0.25, prep_note: 'toasted chips' },
    ],
    suggested_with: ['hummus-trio', 'pomegranate-spritz'],
    related_dishes: ['grilled-halloumi', 'mint-lemonade'],
    alternative_dishes: ['hummus-trio'],
    ai_keywords: ['fresh', 'vegan', 'salad', 'middle eastern'],
  },
  {
    code: 'grilled-halloumi',
    name: 'Grilled Halloumi',
    name_ar: 'حلوم مشوي',
    description: 'Char-grilled halloumi with lemon-mint oil and tomato relish.',
    description_ar: 'حلوم مشوي على الفحم مع زيت الليمون والنعناع ومربى بندورة خفيف.',
    category: 'Appetizers',
    category_ar: 'مقبلات',
    status: 'published',
    price_usd: 9.0,
    calories: 380,
    prep_time_minutes: 8,
    dietary_tags: ['vegetarian', 'gluten_free_option'],
    allergens: ['dairy'],
    spice_level: 0,
    recipe: [
      { ingredient_code: 'halloumi', quantity_required: 120 },
      { ingredient_code: 'olive-oil', quantity_required: 9 },
      { ingredient_code: 'lemon-juice', quantity_required: 8 },
      { ingredient_code: 'mint', quantity_required: 4 },
      { ingredient_code: 'tomato', quantity_required: 35 },
    ],
    suggested_with: ['fattoush-signature', 'mint-lemonade'],
    related_dishes: ['hummus-trio', 'truffle-risotto'],
    alternative_dishes: ['hummus-trio'],
    ai_keywords: ['grilled cheese', 'vegetarian', 'starter'],
  },
  {
    code: 'chicken-shawarma-plate',
    name: 'Chicken Shawarma Plate',
    name_ar: 'صحن شاورما دجاج',
    description: 'Marinated chicken thigh, garlic sauce, pickles, and basmati rice.',
    description_ar: 'دجاج متبّل، صلصة ثوم، مخلل، وأرز بسمتي.',
    category: 'Main Course',
    category_ar: 'طبق رئيسي',
    status: 'published',
    price_usd: 14.5,
    calories: 760,
    prep_time_minutes: 14,
    dietary_tags: ['contains_meat'],
    allergens: ['dairy'],
    spice_level: 1,
    recipe: [
      { ingredient_code: 'chicken-thigh', quantity_required: 220 },
      { ingredient_code: 'garlic', quantity_required: 10 },
      { ingredient_code: 'lemon-juice', quantity_required: 12 },
      { ingredient_code: 'olive-oil', quantity_required: 12 },
      { ingredient_code: 'basmati-rice', quantity_required: 140 },
      { ingredient_code: 'parsley', quantity_required: 6 },
    ],
    suggested_with: ['fattoush-signature', 'mint-lemonade'],
    related_dishes: ['beef-kafta-skewers', 'mixed-grill-platter'],
    alternative_dishes: ['beef-kafta-skewers'],
    ai_keywords: ['shawarma', 'grill', 'chicken', 'comfort food'],
  },
  {
    code: 'beef-kafta-skewers',
    name: 'Beef Kafta Skewers',
    name_ar: 'أسياخ كفتة',
    description: 'Charcoal-grilled kafta skewers served with herb rice and tomato salsa.',
    description_ar: 'أسياخ كفتة مشوية على الفحم مع أرز بالأعشاب وسلطة بندورة.',
    category: 'Grills',
    category_ar: 'مشاوي',
    status: 'published',
    price_usd: 16.0,
    calories: 820,
    prep_time_minutes: 16,
    dietary_tags: ['contains_meat'],
    allergens: [],
    spice_level: 1,
    recipe: [
      { ingredient_code: 'kafta-mix', quantity_required: 240 },
      { ingredient_code: 'parsley', quantity_required: 8 },
      { ingredient_code: 'tomato', quantity_required: 60 },
      { ingredient_code: 'olive-oil', quantity_required: 10 },
      { ingredient_code: 'basmati-rice', quantity_required: 140 },
    ],
    suggested_with: ['hummus-trio', 'pomegranate-spritz'],
    related_dishes: ['mixed-grill-platter', 'chicken-shawarma-plate'],
    alternative_dishes: ['chicken-shawarma-plate'],
    ai_keywords: ['kafta', 'protein', 'grill', 'halal'],
  },
  {
    code: 'mixed-grill-platter',
    name: 'Mixed Grill Platter',
    name_ar: 'صحن مشاوي مشكل',
    description: 'Kafta, chicken, and lamb chops with grilled vegetables and rice.',
    description_ar: 'كفتة ودجاج وريش غنم مع خضار مشوية وأرز.',
    category: 'Grills',
    category_ar: 'مشاوي',
    status: 'published',
    price_usd: 24.0,
    calories: 1080,
    prep_time_minutes: 20,
    dietary_tags: ['contains_meat'],
    allergens: [],
    spice_level: 1,
    recipe: [
      { ingredient_code: 'kafta-mix', quantity_required: 120 },
      { ingredient_code: 'chicken-thigh', quantity_required: 130 },
      { ingredient_code: 'lamb-chops', quantity_required: 120 },
      { ingredient_code: 'basmati-rice', quantity_required: 170 },
      { ingredient_code: 'olive-oil', quantity_required: 16 },
      { ingredient_code: 'tomato', quantity_required: 60 },
    ],
    suggested_with: ['fattoush-signature', 'pomegranate-spritz'],
    related_dishes: ['beef-kafta-skewers', 'chicken-shawarma-plate'],
    alternative_dishes: ['beef-kafta-skewers'],
    ai_keywords: ['sharing', 'grill', 'family style', 'high protein'],
  },
  {
    code: 'sayadieh-seafood',
    name: 'Seafood Sayadieh',
    name_ar: 'صيادية بحرية',
    description: 'Spiced rice with white fish, shrimp, caramelized onions, and tahini-citrus drizzle.',
    description_ar: 'أرز متبّل مع سمك أبيض وروبيان وبصل مكرمل ورشة طحينة حمضيات.',
    category: 'Rice Dishes',
    category_ar: 'أطباق الأرز',
    status: 'published',
    price_usd: 21.0,
    calories: 890,
    prep_time_minutes: 19,
    dietary_tags: ['contains_seafood'],
    allergens: ['fish', 'shellfish', 'sesame'],
    spice_level: 1,
    recipe: [
      { ingredient_code: 'white-fish', quantity_required: 180 },
      { ingredient_code: 'shrimp', quantity_required: 90 },
      { ingredient_code: 'basmati-rice', quantity_required: 165 },
      { ingredient_code: 'tahini', quantity_required: 18 },
      { ingredient_code: 'lemon-juice', quantity_required: 14 },
      { ingredient_code: 'olive-oil', quantity_required: 12 },
    ],
    suggested_with: ['fattoush-signature', 'mint-lemonade'],
    related_dishes: ['truffle-risotto', 'grilled-halloumi'],
    alternative_dishes: ['truffle-risotto'],
    ai_keywords: ['seafood', 'rice', 'signature', 'coastal'],
  },
  {
    code: 'truffle-risotto',
    name: 'Truffle Mushroom Risotto',
    name_ar: 'ريزوتو بالفطر والكمأة',
    description: 'Creamy arborio risotto with sauteed mushrooms, parmesan, and truffle aroma.',
    description_ar: 'ريزوتو كريمي بأرز أربوريو مع فطر سوتيه وبارميزان ونكهة الكمأة.',
    category: 'Pasta',
    category_ar: 'باستا',
    status: 'published',
    price_usd: 17.5,
    calories: 740,
    prep_time_minutes: 18,
    dietary_tags: ['vegetarian'],
    allergens: ['dairy'],
    spice_level: 0,
    recipe: [
      { ingredient_code: 'arborio-rice', quantity_required: 150 },
      { ingredient_code: 'mushroom', quantity_required: 130 },
      { ingredient_code: 'parmesan', quantity_required: 35 },
      { ingredient_code: 'olive-oil', quantity_required: 10 },
      { ingredient_code: 'garlic', quantity_required: 5 },
    ],
    suggested_with: ['grilled-halloumi', 'pomegranate-spritz'],
    related_dishes: ['sayadieh-seafood', 'margherita-pizza'],
    alternative_dishes: ['margherita-pizza'],
    ai_keywords: ['creamy', 'mushroom', 'vegetarian', 'comfort'],
  },
  {
    code: 'margherita-pizza',
    name: 'Margherita Pizza',
    name_ar: 'بيتزا مارغريتا',
    description: 'Stone-baked pizza with tomato sauce, mozzarella, and fresh basil.',
    description_ar: 'بيتزا مخبوزة بالحجر مع صلصة الطماطم والموزاريلا والريحان الطازج.',
    category: 'Pizza',
    category_ar: 'بيتزا',
    status: 'published',
    price_usd: 12.0,
    calories: 830,
    prep_time_minutes: 12,
    dietary_tags: ['vegetarian', 'kids_friendly'],
    allergens: ['gluten', 'dairy'],
    spice_level: 0,
    recipe: [
      { ingredient_code: 'pizza-dough', quantity_required: 1 },
      { ingredient_code: 'pizza-sauce', quantity_required: 90 },
      { ingredient_code: 'mozzarella', quantity_required: 130 },
      { ingredient_code: 'basil', quantity_required: 5 },
      { ingredient_code: 'olive-oil', quantity_required: 8 },
    ],
    suggested_with: ['hummus-trio', 'mint-lemonade'],
    related_dishes: ['pepperoni-pizza', 'truffle-risotto'],
    alternative_dishes: ['pepperoni-pizza'],
    ai_keywords: ['pizza', 'classic', 'family', 'kids'],
  },
  {
    code: 'pepperoni-pizza',
    name: 'Pepperoni Pizza',
    name_ar: 'بيتزا بيبروني',
    description: 'Stone-baked pizza with mozzarella, pepperoni, and oregano finish.',
    description_ar: 'بيتزا مخبوزة بالحجر مع موزاريلا وبيبروني ولمسة أوريغانو.',
    category: 'Pizza',
    category_ar: 'بيتزا',
    status: 'published',
    price_usd: 13.5,
    calories: 980,
    prep_time_minutes: 12,
    dietary_tags: ['contains_meat', 'kids_friendly'],
    allergens: ['gluten', 'dairy'],
    spice_level: 1,
    recipe: [
      { ingredient_code: 'pizza-dough', quantity_required: 1 },
      { ingredient_code: 'pizza-sauce', quantity_required: 95 },
      { ingredient_code: 'mozzarella', quantity_required: 130 },
      { ingredient_code: 'pepperoni', quantity_required: 70 },
      { ingredient_code: 'olive-oil', quantity_required: 8 },
    ],
    suggested_with: ['pomegranate-spritz', 'hummus-trio'],
    related_dishes: ['margherita-pizza', 'mixed-grill-platter'],
    alternative_dishes: ['margherita-pizza'],
    ai_keywords: ['pizza', 'pepperoni', 'hearty'],
  },
  {
    code: 'tiramisu-classic',
    name: 'Classic Tiramisu',
    name_ar: 'تيراميسو كلاسيك',
    description: 'Layered mascarpone cream, espresso-soaked ladyfingers, and cocoa dust.',
    description_ar: 'طبقات من كريمة الماسكربوني وبسكويت مغموس بالإسبريسو ورشة كاكاو.',
    category: 'Desserts',
    category_ar: 'حلويات',
    status: 'published',
    price_usd: 7.0,
    calories: 430,
    prep_time_minutes: 4,
    dietary_tags: ['vegetarian'],
    allergens: ['dairy', 'egg', 'gluten'],
    spice_level: 0,
    recipe: [
      { ingredient_code: 'mascarpone', quantity_required: 95 },
      { ingredient_code: 'ladyfingers', quantity_required: 42 },
      { ingredient_code: 'espresso', quantity_required: 30 },
      { ingredient_code: 'sugar-syrup', quantity_required: 10 },
    ],
    suggested_with: ['mint-lemonade'],
    related_dishes: ['pistachio-kunafa'],
    alternative_dishes: ['pistachio-kunafa'],
    ai_keywords: ['dessert', 'coffee', 'sweet'],
  },
  {
    code: 'pistachio-kunafa',
    name: 'Pistachio Kunafa',
    name_ar: 'كنافة بالفستق',
    description: 'Warm kunafa with pistachio crumble and orange blossom syrup.',
    description_ar: 'كنافة ساخنة مع فستق مطحون وقطر ماء الزهر.',
    category: 'Desserts',
    category_ar: 'حلويات',
    status: 'published',
    price_usd: 8.0,
    calories: 510,
    prep_time_minutes: 10,
    dietary_tags: ['vegetarian'],
    allergens: ['dairy', 'gluten', 'nuts'],
    spice_level: 0,
    recipe: [
      { ingredient_code: 'kunafa-dough', quantity_required: 95 },
      { ingredient_code: 'pistachio', quantity_required: 22 },
      { ingredient_code: 'mozzarella', quantity_required: 70 },
      { ingredient_code: 'orange-blossom-syrup', quantity_required: 28 },
    ],
    suggested_with: ['pomegranate-spritz'],
    related_dishes: ['tiramisu-classic'],
    alternative_dishes: ['tiramisu-classic'],
    ai_keywords: ['arabic dessert', 'sweet', 'pistachio'],
  },
  {
    code: 'mint-lemonade',
    name: 'Mint Lemonade',
    name_ar: 'ليموناضة بالنعناع',
    description: 'Fresh lemon, mint, and light syrup, shaken and served over ice.',
    description_ar: 'ليمون طازج ونعناع وشراب خفيف، مخفوق ومقدّم مع الثلج.',
    category: 'Mocktails',
    category_ar: 'موكتيل',
    status: 'published',
    price_usd: 4.5,
    calories: 130,
    prep_time_minutes: 3,
    dietary_tags: ['vegan', 'kids_friendly'],
    allergens: [],
    spice_level: 0,
    recipe: [
      { ingredient_code: 'lemon-juice', quantity_required: 45 },
      { ingredient_code: 'mint', quantity_required: 6 },
      { ingredient_code: 'sugar-syrup', quantity_required: 18 },
      { ingredient_code: 'sparkling-water', quantity_required: 120 },
    ],
    suggested_with: ['hummus-trio', 'chicken-shawarma-plate'],
    related_dishes: ['pomegranate-spritz'],
    alternative_dishes: ['pomegranate-spritz'],
    ai_keywords: ['fresh', 'drink', 'non-alcoholic'],
  },
  {
    code: 'pomegranate-spritz',
    name: 'Pomegranate Spritz',
    name_ar: 'سبريتز الرمان',
    description: 'Pomegranate juice, sparkling water, mint, and citrus zest.',
    description_ar: 'عصير رمان مع مياه فوارة ونعناع وبرش حمضيات.',
    category: 'Mocktails',
    category_ar: 'موكتيل',
    status: 'published',
    price_usd: 5.0,
    calories: 120,
    prep_time_minutes: 3,
    dietary_tags: ['vegan', 'kids_friendly'],
    allergens: [],
    spice_level: 0,
    recipe: [
      { ingredient_code: 'pomegranate-juice', quantity_required: 80 },
      { ingredient_code: 'sparkling-water', quantity_required: 100 },
      { ingredient_code: 'mint', quantity_required: 5 },
      { ingredient_code: 'sugar-syrup', quantity_required: 10 },
    ],
    suggested_with: ['beef-kafta-skewers', 'pistachio-kunafa'],
    related_dishes: ['mint-lemonade'],
    alternative_dishes: ['mint-lemonade'],
    ai_keywords: ['mocktail', 'fruit-forward', 'refreshing'],
  },
];

export const restaurantAiSeed: RestaurantAiKnowledgeBase = {
  generated_at: '2026-04-19',
  profile: {
    name: 'Cedar Flame Kitchen',
    name_ar: 'مطبخ سيدار فليم',
    slug: 'cedar-flame-kitchen',
    cuisine: ['Levantine', 'Mediterranean', 'Grill House'],
    city: 'Beirut',
    country: 'Lebanon',
    timezone: 'Asia/Beirut',
    currency: 'USD',
    vat_rate: 11,
    service_model: 'casual_dining',
  },
  tables: [
    { name: 'T1', seats: 2, zone: 'indoor' },
    { name: 'T2', seats: 2, zone: 'indoor' },
    { name: 'T3', seats: 4, zone: 'indoor' },
    { name: 'T4', seats: 4, zone: 'indoor' },
    { name: 'T5', seats: 6, zone: 'terrace' },
    { name: 'T6', seats: 6, zone: 'terrace' },
    { name: 'T7', seats: 8, zone: 'terrace' },
  ],
  policies: {
    allergy_notice:
      'Guests should inform staff about allergies before ordering. Shared grill and fryer surfaces may cause cross-contact.',
    halal: true,
    alcohol_served: false,
    kitchen_close_time: '23:30',
    average_ticket_usd: 23,
  },
  inventory,
  dishes,
};

export interface DishSeedDraftPayload {
  code: string;
  name: string;
  name_ar: string;
  description: string;
  description_ar: string;
  category: string;
  category_ar: string;
  status: DishStatusSeed;
  price: string;
  calories: string;
  prep_time_minutes: number;
  dietary_tags: DishDietaryTag[];
  allergens: DishAllergen[];
  spice_level: 0 | 1 | 2 | 3;
  recipe_ingredients: Array<{
    ingredient_code: string;
    quantity_required: string;
    unit: IngredientStockUnit;
  }>;
  suggested_with: string[];
  related_dishes: string[];
  alternative_dishes: string[];
  ai_keywords: string[];
}

export const inventoryIngredientByCode: Record<string, RestaurantAiInventoryIngredient> =
  restaurantAiSeed.inventory.reduce<Record<string, RestaurantAiInventoryIngredient>>((acc, ingredient) => {
    acc[ingredient.code] = ingredient;
    return acc;
  }, {});

export const dishSeedDraftPayloads: DishSeedDraftPayload[] = restaurantAiSeed.dishes.map((dish) => ({
  code: dish.code,
  name: dish.name,
  name_ar: dish.name_ar,
  description: dish.description,
  description_ar: dish.description_ar,
  category: dish.category,
  category_ar: dish.category_ar,
  status: dish.status,
  price: dish.price_usd.toFixed(2),
  calories: dish.calories.toString(),
  prep_time_minutes: dish.prep_time_minutes,
  dietary_tags: dish.dietary_tags,
  allergens: dish.allergens,
  spice_level: dish.spice_level,
  recipe_ingredients: dish.recipe.map((recipeRow) => ({
    ingredient_code: recipeRow.ingredient_code,
    quantity_required: recipeRow.quantity_required.toString(),
    unit: inventoryIngredientByCode[recipeRow.ingredient_code]?.unit ?? 'g',
  })),
  suggested_with: dish.suggested_with,
  related_dishes: dish.related_dishes,
  alternative_dishes: dish.alternative_dishes,
  ai_keywords: dish.ai_keywords,
}));

export interface ExistingInventoryIngredientRef {
  id: number;
  name: string;
  name_ar?: string | null;
  unit: IngredientStockUnit;
}

export interface DishSeedMappedRecipeRow {
  ingredient_id: number;
  ingredient_code: string;
  quantity_required: string;
}

export interface DishSeedMappedPayload extends Omit<DishSeedDraftPayload, 'recipe_ingredients'> {
  recipe_ingredients: DishSeedMappedRecipeRow[];
}

export interface DishSeedMissingIngredient {
  dish_code: string;
  dish_name: string;
  ingredient_code: string;
  ingredient_name: string;
}

export interface DishSeedMapResult {
  payloads: DishSeedMappedPayload[];
  missing_ingredients: DishSeedMissingIngredient[];
  dishes_without_recipe: string[];
}

const normalizeLookup = (value?: string | null): string => (
  (value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
);

const findExistingIngredient = (
  lookup: Map<string, ExistingInventoryIngredientRef>,
  recipeIngredientCode: string
): ExistingInventoryIngredientRef | undefined => {
  const seedIngredient = inventoryIngredientByCode[recipeIngredientCode];
  const fallbackLabel = recipeIngredientCode.replace(/-/g, ' ');
  const candidates = [
    normalizeLookup(seedIngredient?.name),
    normalizeLookup(seedIngredient?.name_ar),
    normalizeLookup(fallbackLabel),
    normalizeLookup(recipeIngredientCode),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const match = lookup.get(candidate);
    if (match) return match;
  }

  return undefined;
};

export const buildDishPayloadsUsingExistingInventory = (
  existingInventory: ExistingInventoryIngredientRef[]
): DishSeedMapResult => {
  const lookup = new Map<string, ExistingInventoryIngredientRef>();

  existingInventory.forEach((ingredient) => {
    const keys = [
      normalizeLookup(ingredient.name),
      normalizeLookup(ingredient.name_ar),
    ].filter(Boolean);

    keys.forEach((key) => {
      if (!lookup.has(key)) {
        lookup.set(key, ingredient);
      }
    });
  });

  const missing_ingredients: DishSeedMissingIngredient[] = [];
  const payloads: DishSeedMappedPayload[] = dishSeedDraftPayloads.map((dish) => {
    const recipe_ingredients: DishSeedMappedRecipeRow[] = [];

    dish.recipe_ingredients.forEach((recipeRow) => {
      const match = findExistingIngredient(lookup, recipeRow.ingredient_code);

      if (!match) {
        missing_ingredients.push({
          dish_code: dish.code,
          dish_name: dish.name,
          ingredient_code: recipeRow.ingredient_code,
          ingredient_name: inventoryIngredientByCode[recipeRow.ingredient_code]?.name
            || recipeRow.ingredient_code.replace(/-/g, ' '),
        });
        return;
      }

      recipe_ingredients.push({
        ingredient_id: match.id,
        ingredient_code: recipeRow.ingredient_code,
        quantity_required: recipeRow.quantity_required,
      });
    });

    return {
      ...dish,
      recipe_ingredients,
    };
  });

  const dishes_without_recipe = payloads
    .filter((dish) => dish.recipe_ingredients.length === 0)
    .map((dish) => dish.code);

  return {
    payloads,
    missing_ingredients,
    dishes_without_recipe,
  };
};

export const getDishSeedByCode = (code: string): RestaurantAiDish | undefined => {
  const normalizedCode = code.trim().toLowerCase();
  return restaurantAiSeed.dishes.find((dish) => dish.code.toLowerCase() === normalizedCode);
};

export const getInventoryIngredientByCode = (code: string): RestaurantAiInventoryIngredient | undefined => {
  const normalizedCode = code.trim().toLowerCase();
  return restaurantAiSeed.inventory.find((ingredient) => ingredient.code.toLowerCase() === normalizedCode);
};

export const buildRestaurantAiGroundTruthJson = (): string => JSON.stringify(restaurantAiSeed, null, 2);
