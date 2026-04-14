export interface MenuCategoryDefinition {
  value: string;
  arabic: string;
  aliases?: string[];
}

export const MENU_CATEGORIES: MenuCategoryDefinition[] = [
  // Core
  { value: 'Appetizers', arabic: 'مقبلات', aliases: ['appetizer', 'appetizers', 'starters'] },
  { value: 'Salads', arabic: 'سلطات', aliases: ['salad', 'salads'] },
  { value: 'Soups', arabic: 'شوربات', aliases: ['soup', 'soups'] },
  { value: 'Main Courses', arabic: 'الأطباق الرئيسية', aliases: ['main', 'mains', 'main course', 'main courses'] },
  { value: 'Sides', arabic: 'أطباق جانبية', aliases: ['side', 'sides'] },
  { value: 'Desserts', arabic: 'حلويات', aliases: ['dessert', 'desserts', 'sweet', 'sweets'] },
  { value: 'Drinks', arabic: 'مشروبات', aliases: ['drink', 'drinks', 'beverage', 'beverages'] },

  // Fast food / Western
  { value: 'Pizza', arabic: 'بيتزا', aliases: ['pizza'] },
  { value: 'Specialty Pizza', arabic: 'بيتزا خاصة', aliases: ['specialty pizza'] },
  { value: 'Burgers', arabic: 'برغر', aliases: ['burger', 'burgers'] },
  { value: 'Sandwiches', arabic: 'ساندويتشات', aliases: ['sandwich', 'sandwiches'] },
  { value: 'Wraps', arabic: 'راب', aliases: ['wrap', 'wraps'] },
  { value: 'Hot Dogs', arabic: 'هوت دوغ', aliases: ['hot dog', 'hot dogs'] },
  { value: 'Pasta', arabic: 'باستا', aliases: ['pasta'] },
  { value: 'Rice Dishes', arabic: 'أطباق الأرز', aliases: ['rice', 'rice dishes'] },
  { value: 'Noodles', arabic: 'نودلز', aliases: ['noodle', 'noodles'] },

  // Protein-based
  { value: 'Chicken', arabic: 'دجاج', aliases: ['chicken'] },
  { value: 'Beef', arabic: 'لحم بقري', aliases: ['beef'] },
  { value: 'Lamb', arabic: 'لحم غنم', aliases: ['lamb'] },
  { value: 'Seafood', arabic: 'مأكولات بحرية', aliases: ['seafood', 'fish', 'shrimp'] },
  { value: 'Vegetarian', arabic: 'نباتي', aliases: ['vegetarian', 'veggie'] },
  { value: 'Vegan', arabic: 'نباتي صرف', aliases: ['vegan'] },

  // Arabic / Middle Eastern
  { value: 'Cold Mezze', arabic: 'مقبلات باردة', aliases: ['cold mezze'] },
  { value: 'Hot Mezze', arabic: 'مقبلات ساخنة', aliases: ['hot mezze'] },
  { value: 'Grills', arabic: 'مشاوي', aliases: ['grill', 'grills', 'bbq'] },
  { value: 'Shawarma', arabic: 'شاورما', aliases: ['shawarma'] },
  { value: 'Manakish', arabic: 'مناقيش', aliases: ['manakish', 'manousheh'] },
  { value: 'Traditional Dishes', arabic: 'أكلات تقليدية', aliases: ['traditional', 'arabic dishes'] },

  // Cuisine-based
  { value: 'Italian', arabic: 'إيطالي', aliases: ['italian'] },
  { value: 'American', arabic: 'أمريكي', aliases: ['american'] },
  { value: 'Mexican', arabic: 'مكسيكي', aliases: ['mexican'] },
  { value: 'Indian', arabic: 'هندي', aliases: ['indian'] },
  { value: 'Chinese', arabic: 'صيني', aliases: ['chinese'] },
  { value: 'Japanese', arabic: 'ياباني', aliases: ['japanese'] },
  { value: 'Thai', arabic: 'تايلندي', aliases: ['thai'] },
  { value: 'Korean', arabic: 'كوري', aliases: ['korean'] },
  { value: 'Mediterranean', arabic: 'متوسطي', aliases: ['mediterranean'] },
  { value: 'Turkish', arabic: 'تركي', aliases: ['turkish'] },

  // Time-based
  { value: 'Breakfast', arabic: 'فطور', aliases: ['breakfast'] },
  { value: 'Brunch', arabic: 'فطور متأخر', aliases: ['brunch'] },
  { value: 'Lunch', arabic: 'غداء', aliases: ['lunch'] },
  { value: 'Dinner', arabic: 'عشاء', aliases: ['dinner'] },

  // Café / drinks
  { value: 'Hot Drinks', arabic: 'مشروبات ساخنة', aliases: ['hot drinks'] },
  { value: 'Cold Drinks', arabic: 'مشروبات باردة', aliases: ['cold drinks'] },
  { value: 'Coffee', arabic: 'قهوة', aliases: ['coffee'] },
  { value: 'Tea', arabic: 'شاي', aliases: ['tea'] },
  { value: 'Fresh Juices', arabic: 'عصائر طازجة', aliases: ['juice', 'juices'] },
  { value: 'Smoothies', arabic: 'سموذي', aliases: ['smoothie', 'smoothies'] },
  { value: 'Milkshakes', arabic: 'ميلك شيك', aliases: ['milkshake', 'milkshakes'] },
  { value: 'Soft Drinks', arabic: 'مشروبات غازية', aliases: ['soft drinks', 'soda'] },
  { value: 'Mocktails', arabic: 'موكتيل', aliases: ['mocktail', 'mocktails'] },

  // Desserts / bakery
  { value: 'Cakes', arabic: 'كيك', aliases: ['cake', 'cakes'] },
  { value: 'Pastries', arabic: 'معجنات', aliases: ['pastry', 'pastries'] },
  { value: 'Ice Cream', arabic: 'آيس كريم', aliases: ['ice cream'] },
  { value: 'Arabic Sweets', arabic: 'حلويات عربية', aliases: ['arabic sweets'] },
  { value: 'Bakery', arabic: 'مخبوزات', aliases: ['bakery'] },

  // Functional categories
  { value: 'Chef Specials', arabic: 'أطباق الشيف', aliases: ['specials', 'chef special'] },
  { value: 'Popular Items', arabic: 'الأكثر طلبًا', aliases: ['popular', 'best sellers'] },
  { value: 'New Items', arabic: 'جديد', aliases: ['new'] },
  { value: 'Signature Dishes', arabic: 'أطباق مميزة', aliases: ['signature'] },
  { value: 'Combo Meals', arabic: 'وجبات كومبو', aliases: ['combo', 'combo meals'] },
  { value: 'Kids Menu', arabic: 'قائمة الأطفال', aliases: ['kids', 'kids menu'] },
  { value: 'Healthy Options', arabic: 'خيارات صحية', aliases: ['healthy'] },
  { value: 'Gluten Free', arabic: 'خالٍ من الغلوتين', aliases: ['gluten free'] },
  { value: 'Low Carb', arabic: 'منخفض الكربوهيدرات', aliases: ['low carb'] },
  { value: 'Spicy', arabic: 'حار', aliases: ['spicy'] },

  // Buffet / hotel
  { value: 'Buffet', arabic: 'بوفيه', aliases: ['buffet'] },
  { value: 'Live Cooking', arabic: 'طبخ مباشر', aliases: ['live cooking'] },
  { value: 'Salad Bar', arabic: 'بار سلطات', aliases: ['salad bar'] },
  { value: 'Dessert Station', arabic: 'ركن الحلويات', aliases: ['dessert station'] },
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
