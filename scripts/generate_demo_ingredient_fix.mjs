import fs from 'node:fs';
import path from 'node:path';

const alphaId = 28;
const sigmaId = 29;

const existingIngredients = {
  [alphaId]: new Set([
    'basmati rice',
    'Beef Sirloin',
    'chicken breast',
    'Chickpea',
    'Cucumber',
    'Feta Cheese',
    'Garlic',
    'greek yogurt',
    'Halloumi Cheese',
    'Ice Cube',
    'lemon juice',
    'Lettuce',
    'Mint',
    'olive oil',
    'orange juice',
    'Parsley',
    'Pita Bread',
    'Pomegranate Molasses',
    'red onion',
    'Salmon Fillet',
    'Shrimp',
    'sparkling water',
    'sugar syrup',
    'Tahini',
    'Tomato',
  ]),
  [sigmaId]: new Set([
    'beef tenderloin',
    'bell pepper',
    'black tea',
    'Carrot',
    'chicken thigh',
    'chili sauce',
    'Coconut Milk',
    'egg noodle',
    'Garlic',
    'Ginger',
    'green tea',
    'Honey',
    'Ice Cube',
    'jasmine rice',
    'Lime Juice',
    'Miso Paste',
    'Mushroom',
    'Ramen Noodle',
    'Salmon Fillet',
    'sesame oil',
    'Shrimp',
    'soy sauce',
    'sparkling water',
    'Spring Onion',
    'sugar syrup',
    'Tofu',
  ]),
};

const unitOverrides = new Map([
  ['Burger Bun', 'piece'],
  ['Sandwich Bread', 'piece'],
  ['Baguette', 'piece'],
  ['Hoagie Roll', 'piece'],
  ['Pizza Dough', 'piece'],
  ['Pita Bread', 'piece'],
  ['Ice Cube', 'piece'],
  ['Chicken Wings', 'piece'],
  ['Milk', 'ml'],
  ['Cream', 'ml'],
  ['Coffee', 'g'],
  ['Espresso', 'ml'],
  ['Chocolate Sauce', 'ml'],
  ['Buffalo Sauce', 'ml'],
  ['BBQ Sauce', 'ml'],
  ['Truffle Oil', 'ml'],
  ['Pizza Sauce', 'g'],
  ['Caesar Dressing', 'g'],
  ['Mayonnaise', 'g'],
  ['Pomegranate Juice', 'ml'],
  ['Yuzu Juice', 'ml'],
  ['olive oil', 'ml'],
  ['sesame oil', 'ml'],
  ['orange juice', 'ml'],
  ['lemon juice', 'ml'],
  ['Lime Juice', 'ml'],
  ['sparkling water', 'ml'],
  ['sugar syrup', 'ml'],
]);

const additions = {
  [alphaId]: new Set(),
  [sigmaId]: new Set(),
};

const recipes = [];

function unitFor(name) {
  return unitOverrides.get(name) ?? 'g';
}

function item(name, quantity, unit = unitFor(name)) {
  return { name, quantity, unit };
}

function pushRecipe(restaurantId, dishName, items) {
  const seen = new Set();
  const normalized = [];

  for (const current of items) {
    if (seen.has(current.name)) continue;
    seen.add(current.name);
    normalized.push(current);
    if (!existingIngredients[restaurantId].has(current.name)) {
      additions[restaurantId].add(current.name);
    }
  }

  recipes.push({ restaurantId, dishName, items: normalized });
}

function sqlEscape(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}

function alphaProtein(label) {
  switch (label) {
    case 'Chicken':
      return item('chicken breast', 150);
    case 'Beef':
      return item('Beef Sirloin', 150);
    case 'Salmon':
      return item('Salmon Fillet', 140);
    case 'Shrimp':
      return item('Shrimp', 130);
    case 'Halloumi':
      return item('Halloumi Cheese', 100);
    case 'Chickpea':
      return item('Chickpea', 110);
    case 'Feta':
      return item('Feta Cheese', 90);
    default:
      throw new Error(`Unknown Alpha protein: ${label}`);
  }
}

function sigmaProtein(label) {
  switch (label) {
    case 'Chicken':
      return [item('chicken thigh', 150)];
    case 'Beef':
      return [item('beef tenderloin', 150)];
    case 'Shrimp':
      return [item('Shrimp', 130)];
    case 'Salmon':
      return [item('Salmon Fillet', 140)];
    case 'Tofu':
      return [item('Tofu', 120)];
    case 'Mushroom':
      return [item('Mushroom', 110)];
    case 'Mixed Protein':
      return [
        item('chicken thigh', 80),
        item('beef tenderloin', 80),
        item('Shrimp', 70),
      ];
    default:
      throw new Error(`Unknown Sigma protein: ${label}`);
  }
}

function alphaStyleExtras(style) {
  switch (style) {
    case 'Charred':
    case 'Citrus':
      return [item('Garlic', 6), item('lemon juice', 15)];
    case 'Herb-Roasted':
      return [item('Garlic', 6), item('lemon juice', 15), item('greek yogurt', 30), item('Mint', 5)];
    case 'Smoked':
      return [item('Garlic', 6), item('lemon juice', 15), item('Pomegranate Molasses', 12)];
    case 'Fire-Grilled':
      return [item('Garlic', 6), item('lemon juice', 15), item('Parsley', 6)];
    default:
      throw new Error(`Unknown Alpha style: ${style}`);
  }
}

function alphaRecipe(style, label, format) {
  const protein = alphaProtein(label);
  const tahiniExtras = label === 'Halloumi' || label === 'Feta' ? [item('Tahini', 25)] : [];
  const base = [];

  switch (format) {
    case 'Rice Bowl':
      base.push(item('basmati rice', 180), protein, item('Lettuce', 45), item('Tomato', 55), item('Cucumber', 55), item('red onion', 20), item('Parsley', 8), item('olive oil', 10));
      break;
    case 'Pita Wrap':
      base.push(item('Pita Bread', 1), protein, item('Lettuce', 35), item('Tomato', 45), item('Cucumber', 40), item('red onion', 18), item('Parsley', 6), item('olive oil', 8));
      break;
    case 'Garden Salad':
      base.push(item('Lettuce', 80), protein, item('Tomato', 60), item('Cucumber', 60), item('red onion', 20), item('Parsley', 8), item('olive oil', 10));
      break;
    case 'Mediterranean Plate':
      base.push(protein, item('Tomato', 60), item('Cucumber', 60), item('red onion', 20), item('Parsley', 8), item('olive oil', 10));
      break;
    case 'Lemon Rice Plate':
      base.push(item('basmati rice', 170), protein, item('Tomato', 50), item('Cucumber', 50), item('red onion', 18), item('Parsley', 6), item('olive oil', 10));
      break;
    case 'Warm Mezze Bowl':
      base.push(item('Pita Bread', 1), protein, item('Lettuce', 50), item('Tomato', 50), item('Cucumber', 50), item('red onion', 20), item('Parsley', 8), item('olive oil', 10));
      break;
    default:
      throw new Error(`Unknown Alpha format: ${format}`);
  }

  return [...base, ...alphaStyleExtras(style), ...tahiniExtras];
}

function sigmaStyleExtras(style, format) {
  switch (style) {
    case 'Wok-Fired':
      return [item('soy sauce', 18)];
    case 'Umami':
      return [item('soy sauce', 16), item('Miso Paste', 20)];
    case 'Sesame':
      return [item('soy sauce', 16), item('sesame oil', 10)];
    case 'Spicy':
      return [item('soy sauce', 14), item('chili sauce', 18)];
    case 'Teriyaki':
      return [item('soy sauce', 16), item('Honey', 18)];
    default:
      throw new Error(`Unknown Sigma style: ${style}`);
  }
}

function sigmaRecipe(style, label, format) {
  const proteins = sigmaProtein(label);
  const base = [];
  const aromatics = [item('Garlic', 8), item('Ginger', 8), item('Spring Onion', 15)];

  switch (format) {
    case 'Ramen Bowl':
      base.push(item('Ramen Noodle', 170), ...proteins, ...aromatics);
      if (label !== 'Mushroom') base.push(item('Mushroom', 35));
      break;
    case 'Egg Noodle Bowl':
      base.push(item('egg noodle', 170), ...proteins, item('bell pepper', 50), item('Carrot', 45), ...aromatics);
      break;
    case 'Jasmine Rice Bowl':
      base.push(item('jasmine rice', 180), ...proteins, item('bell pepper', 50), item('Carrot', 45), ...aromatics);
      break;
    case 'Stir Fry Plate':
      base.push(...proteins, item('bell pepper', 60), item('Carrot', 50), ...aromatics);
      break;
    case 'Curry Bowl':
      base.push(item('jasmine rice', 160), ...proteins, item('Coconut Milk', 100), item('bell pepper', 50), item('Carrot', 45), ...aromatics, item('Lime Juice', 12));
      break;
    case 'Street Bowl':
      base.push(item('jasmine rice', 170), ...proteins, item('bell pepper', 55), item('Carrot', 45), ...aromatics);
      break;
    default:
      throw new Error(`Unknown Sigma format: ${format}`);
  }

  return [...base, ...sigmaStyleExtras(style, format)];
}

const alphaStyles = ['Charred', 'Citrus', 'Herb-Roasted', 'Smoked'];
const alphaProteins = ['Chicken', 'Beef', 'Salmon', 'Shrimp', 'Halloumi', 'Chickpea', 'Feta'];

for (const style of alphaStyles) {
  for (const protein of alphaProteins) {
    pushRecipe(alphaId, `${style} ${protein} Rice Bowl`, alphaRecipe(style, protein, 'Rice Bowl'));
    pushRecipe(alphaId, `${style} ${protein} Pita Wrap`, alphaRecipe(style, protein, 'Pita Wrap'));
    pushRecipe(alphaId, `${style} ${protein} Garden Salad`, alphaRecipe(style, protein, 'Garden Salad'));
    pushRecipe(alphaId, `${style} ${protein} Mediterranean Plate`, alphaRecipe(style, protein, 'Mediterranean Plate'));
    pushRecipe(alphaId, `${style} ${protein} Lemon Rice Plate`, alphaRecipe(style, protein, 'Lemon Rice Plate'));
    pushRecipe(alphaId, `${style} ${protein} Warm Mezze Bowl`, alphaRecipe(style, protein, 'Warm Mezze Bowl'));
  }
}

pushRecipe(alphaId, 'Fire-Grilled Chicken Rice Bowl', alphaRecipe('Fire-Grilled', 'Chicken', 'Rice Bowl'));
pushRecipe(alphaId, 'Fire-Grilled Chicken Pita Wrap', alphaRecipe('Fire-Grilled', 'Chicken', 'Pita Wrap'));

const alphaWestern = {
  'Chicken Wings': [
    item('Chicken Wings', 6),
    item('Buffalo Sauce', 25),
    item('Garlic', 8),
  ],
  'Garlic Bread': [
    item('Baguette', 1),
    item('Garlic', 10),
    item('Butter', 20),
    item('Parsley', 6),
  ],
  'Loaded Nachos': [
    item('Tortilla Chips', 120),
    item('Beef Sirloin', 110),
    item('Cheddar Cheese', 60),
    item('Tomato', 40),
    item('Jalapeno', 20),
  ],
  'Mozzarella Sticks': [
    item('Mozzarella Cheese', 100),
    item('Breadcrumbs', 40),
    item('Pizza Sauce', 35),
  ],
  'Classic Beef Burger': [
    item('Burger Bun', 1),
    item('Beef Sirloin', 150),
    item('Cheddar Cheese', 30),
    item('Lettuce', 20),
    item('Tomato', 30),
  ],
  'Crispy Chicken Burger': [
    item('Burger Bun', 1),
    item('chicken breast', 140),
    item('Lettuce', 20),
    item('Tomato', 30),
    item('Mayonnaise', 25),
  ],
  'Mushroom Swiss Burger': [
    item('Burger Bun', 1),
    item('Beef Sirloin', 150),
    item('Mushroom', 50),
    item('Swiss Cheese', 30),
    item('Lettuce', 20),
    item('Tomato', 30),
  ],
  'Spicy Jalapeño Burger': [
    item('Burger Bun', 1),
    item('Beef Sirloin', 150),
    item('Cheddar Cheese', 30),
    item('Jalapeno', 20),
    item('Lettuce', 20),
    item('Tomato', 30),
  ],
  'Brownie Sundae': [
    item('Brownie', 120),
    item('Vanilla Ice Cream', 90),
    item('Chocolate Sauce', 30),
  ],
  'Chocolate Lava Cake': [
    item('Dark Chocolate', 80),
    item('Butter', 40),
    item('Flour', 30),
    item('Sugar', 20),
  ],
  'New York Cheesecake': [
    item('Cream Cheese', 120),
    item('Sugar', 30),
    item('Graham Cracker', 40),
  ],
  'Tiramisu': [
    item('Mascarpone', 90),
    item('Ladyfingers', 70),
    item('Espresso', 30),
    item('Cocoa Powder', 10),
  ],
  'Margherita Pizza': [
    item('Pizza Dough', 1),
    item('Pizza Sauce', 70),
    item('Mozzarella Cheese', 120),
    item('Basil', 8),
  ],
  'Pepperoni Pizza': [
    item('Pizza Dough', 1),
    item('Pizza Sauce', 70),
    item('Mozzarella Cheese', 120),
    item('Pepperoni', 70),
  ],
  'Vegetarian Pizza': [
    item('Pizza Dough', 1),
    item('Pizza Sauce', 70),
    item('Mozzarella Cheese', 120),
    item('Mushroom', 45),
    item('Bell Pepper', 40),
    item('Tomato', 35),
    item('red onion', 20),
  ],
  'Four Cheese Pizza': [
    item('Pizza Dough', 1),
    item('Pizza Sauce', 65),
    item('Mozzarella Cheese', 90),
    item('Feta Cheese', 35),
    item('Halloumi Cheese', 35),
    item('Parmesan Cheese', 20),
  ],
  'BBQ Chicken Pizza': [
    item('Pizza Dough', 1),
    item('BBQ Sauce', 65),
    item('Mozzarella Cheese', 110),
    item('chicken breast', 100),
    item('red onion', 20),
  ],
  'Buffalo Chicken Pizza': [
    item('Pizza Dough', 1),
    item('Buffalo Sauce', 55),
    item('Mozzarella Cheese', 110),
    item('chicken breast', 100),
    item('red onion', 20),
  ],
  'Truffle Mushroom Pizza': [
    item('Pizza Dough', 1),
    item('Mozzarella Cheese', 120),
    item('Mushroom', 60),
    item('Truffle Oil', 10),
    item('Parmesan Cheese', 20),
  ],
  'Meat Lovers Pizza': [
    item('Pizza Dough', 1),
    item('Pizza Sauce', 70),
    item('Mozzarella Cheese', 120),
    item('Beef Sirloin', 70),
    item('Pepperoni', 60),
    item('Beef Bacon', 40),
  ],
  'Chicken Alfredo Pasta': [
    item('Penne Pasta', 160),
    item('chicken breast', 120),
    item('Cream', 90),
    item('Parmesan Cheese', 25),
    item('Garlic', 8),
  ],
  'Pesto Penne Pasta': [
    item('Penne Pasta', 160),
    item('Basil', 12),
    item('Parmesan Cheese', 25),
    item('Garlic', 8),
    item('olive oil', 12),
  ],
  'Shrimp Arrabbiata': [
    item('Penne Pasta', 160),
    item('Shrimp', 120),
    item('Tomato', 70),
    item('Garlic', 8),
    item('Chili Flakes', 6),
  ],
  'Spaghetti Bolognese': [
    item('Spaghetti Pasta', 170),
    item('Beef Sirloin', 120),
    item('Tomato', 70),
    item('Garlic', 8),
    item('Onion', 35),
  ],
  'Avocado Quinoa Salad': [
    item('Avocado', 90),
    item('Quinoa', 120),
    item('Lettuce', 70),
    item('Tomato', 50),
    item('Cucumber', 50),
    item('olive oil', 10),
    item('lemon juice', 12),
  ],
  'Caesar Salad': [
    item('Lettuce', 90),
    item('Croutons', 35),
    item('Parmesan Cheese', 25),
    item('Caesar Dressing', 35),
  ],
  'Greek Salad': [
    item('Lettuce', 50),
    item('Tomato', 60),
    item('Cucumber', 60),
    item('Feta Cheese', 50),
    item('red onion', 20),
    item('olive oil', 10),
  ],
  'Grilled Chicken Salad': [
    item('chicken breast', 120),
    item('Lettuce', 80),
    item('Tomato', 50),
    item('Cucumber', 50),
    item('olive oil', 10),
  ],
  'Grilled Chicken Sandwich': [
    item('Sandwich Bread', 2),
    item('chicken breast', 120),
    item('Lettuce', 20),
    item('Tomato', 30),
    item('Mayonnaise', 25),
  ],
  'Philly Cheesesteak': [
    item('Hoagie Roll', 1),
    item('Beef Sirloin', 130),
    item('Bell Pepper', 40),
    item('Onion', 30),
    item('Mozzarella Cheese', 35),
  ],
  'Tuna Melt Sandwich': [
    item('Sandwich Bread', 2),
    item('Tuna', 100),
    item('Cheddar Cheese', 35),
    item('Tomato', 25),
    item('Mayonnaise', 20),
  ],
  'Turkey Club Sandwich': [
    item('Sandwich Bread', 3),
    item('Turkey Slices', 90),
    item('Beef Bacon', 35),
    item('Lettuce', 20),
    item('Tomato', 30),
    item('Mayonnaise', 25),
  ],
  'French Fries': [
    item('Potato', 180),
  ],
  'Cheesy Fries': [
    item('Potato', 180),
    item('Cheddar Cheese', 60),
    item('Jalapeno', 20),
  ],
  'Onion Rings': [
    item('Onion', 130),
    item('Breadcrumbs', 45),
  ],
  'Coleslaw': [
    item('Cabbage', 100),
    item('Carrot', 45),
    item('Mayonnaise', 30),
  ],
};

for (const [dishName, items] of Object.entries(alphaWestern)) {
  pushRecipe(alphaId, dishName, items);
}

function alphaDrinkRecipe(name) {
  if (name === 'Fresh Lemon Mint') {
    return [
      item('lemon juice', 30),
      item('Mint', 8),
      item('Ice Cube', 6),
      item('sugar syrup', 20),
      item('sparkling water', 180),
    ];
  }

  if (name === 'Iced Coffee') {
    return [
      item('Coffee', 18),
      item('Milk', 180),
      item('Ice Cube', 6),
      item('sugar syrup', 15),
    ];
  }

  if (name === 'Mango Smoothie') {
    return [
      item('Mango', 120),
      item('greek yogurt', 100),
      item('Ice Cube', 5),
      item('sugar syrup', 15),
    ];
  }

  if (name === 'Strawberry Milkshake') {
    return [
      item('Strawberry', 100),
      item('Milk', 180),
      item('Vanilla Ice Cream', 90),
      item('Ice Cube', 4),
    ];
  }

  const items = [item('Ice Cube', 6), item('sugar syrup', 18)];

  if (name.includes('Orange') || name.includes('Sunset') || name.includes('Citrus')) {
    items.push(item('orange juice', 70));
  }

  if (name.includes('Lemon') || name.includes('Lemonade') || name.includes('Citrus') || name.includes('Garden') || name.includes('Mint') || name.includes('Punch') || name.includes('Club Soda')) {
    items.push(item('lemon juice', 30));
  }

  if (name.includes('Mint') || name.includes('Cucumber') || name.includes('Garden') || name.includes('Citrus')) {
    items.push(item('Mint', 6));
  }

  if (name.includes('Pomegranate')) {
    items.push(item('Pomegranate Juice', 60));
  }

  if (name.includes('Cucumber')) {
    items.push(item('Cucumber', 30));
  }

  if (name.includes('Basil')) {
    items.push(item('Basil', 5));
  }

  if (!name.includes('Classic House Lemonade')) {
    items.push(item('sparkling water', 180));
  }

  return items;
}

const alphaDrinks = [
  'Citrus Club Soda',
  'Citrus Mint Sparkler',
  'Classic House Lemonade',
  'Cucumber Mint Refresher',
  'Fresh Lemon Mint',
  'Fresh Mint Lemon Lift',
  'Iced Coffee',
  'Lemon Garden Cooler',
  'Lemon Ice Splash',
  'Lemonade Signature No.1',
  'Lemonade Signature No.2',
  'Mango Smoothie',
  'Minty Orange Burst',
  'Orange Basil Cooler',
  'Orange Cooler No.1',
  'Orange Cooler No.2',
  'Orange Cooler No.3',
  'Pomegranate Lemon Fizz',
  'Pomegranate Mint Soda',
  'Pomegranate Spark No.1',
  'Pomegranate Spark No.2',
  'Sparkling Citrus Punch',
  'Strawberry Milkshake',
  'Sunset Orange Spritz',
];

for (const name of alphaDrinks) {
  pushRecipe(alphaId, name, alphaDrinkRecipe(name));
}

const sigmaStyles = ['Wok-Fired', 'Umami', 'Sesame', 'Spicy'];
const sigmaProteins = ['Chicken', 'Beef', 'Shrimp', 'Salmon', 'Tofu', 'Mushroom', 'Mixed Protein'];

for (const style of sigmaStyles) {
  for (const protein of sigmaProteins) {
    pushRecipe(sigmaId, `${style} ${protein} Ramen Bowl`, sigmaRecipe(style, protein, 'Ramen Bowl'));
    pushRecipe(sigmaId, `${style} ${protein} Egg Noodle Bowl`, sigmaRecipe(style, protein, 'Egg Noodle Bowl'));
    pushRecipe(sigmaId, `${style} ${protein} Jasmine Rice Bowl`, sigmaRecipe(style, protein, 'Jasmine Rice Bowl'));
    pushRecipe(sigmaId, `${style} ${protein} Stir Fry Plate`, sigmaRecipe(style, protein, 'Stir Fry Plate'));
    pushRecipe(sigmaId, `${style} ${protein} Curry Bowl`, sigmaRecipe(style, protein, 'Curry Bowl'));
    pushRecipe(sigmaId, `${style} ${protein} Street Bowl`, sigmaRecipe(style, protein, 'Street Bowl'));
  }
}

pushRecipe(sigmaId, 'Teriyaki Chicken Ramen Bowl', sigmaRecipe('Teriyaki', 'Chicken', 'Ramen Bowl'));
pushRecipe(sigmaId, 'Teriyaki Chicken Egg Noodle Bowl', sigmaRecipe('Teriyaki', 'Chicken', 'Egg Noodle Bowl'));

function sigmaWestern(items) {
  return items;
}

const sigmaWesternRecipes = {
  'Chicken Wings': sigmaWestern([
    item('Chicken Wings', 6),
    item('Buffalo Sauce', 25),
    item('Garlic', 8),
  ]),
  'Garlic Bread': sigmaWestern([
    item('Baguette', 1),
    item('Garlic', 10),
    item('Butter', 20),
    item('Parsley', 6),
  ]),
  'Loaded Nachos': sigmaWestern([
    item('Tortilla Chips', 120),
    item('beef tenderloin', 110),
    item('Cheddar Cheese', 60),
    item('Tomato', 40),
    item('Jalapeno', 20),
  ]),
  'Mozzarella Sticks': sigmaWestern([
    item('Mozzarella Cheese', 100),
    item('Breadcrumbs', 40),
    item('Pizza Sauce', 35),
  ]),
  'Classic Beef Burger': sigmaWestern([
    item('Burger Bun', 1),
    item('beef tenderloin', 150),
    item('Cheddar Cheese', 30),
    item('Lettuce', 20),
    item('Tomato', 30),
  ]),
  'Crispy Chicken Burger': sigmaWestern([
    item('Burger Bun', 1),
    item('chicken thigh', 140),
    item('Lettuce', 20),
    item('Tomato', 30),
    item('Mayonnaise', 25),
  ]),
  'Mushroom Swiss Burger': sigmaWestern([
    item('Burger Bun', 1),
    item('beef tenderloin', 150),
    item('Mushroom', 50),
    item('Swiss Cheese', 30),
    item('Lettuce', 20),
    item('Tomato', 30),
  ]),
  'Spicy Jalapeño Burger': sigmaWestern([
    item('Burger Bun', 1),
    item('beef tenderloin', 150),
    item('Cheddar Cheese', 30),
    item('Jalapeno', 20),
    item('Lettuce', 20),
    item('Tomato', 30),
  ]),
  'Brownie Sundae': sigmaWestern([
    item('Brownie', 120),
    item('Vanilla Ice Cream', 90),
    item('Chocolate Sauce', 30),
  ]),
  'Chocolate Lava Cake': sigmaWestern([
    item('Dark Chocolate', 80),
    item('Butter', 40),
    item('Flour', 30),
    item('Sugar', 20),
  ]),
  'New York Cheesecake': sigmaWestern([
    item('Cream Cheese', 120),
    item('Sugar', 30),
    item('Graham Cracker', 40),
  ]),
  'Tiramisu': sigmaWestern([
    item('Mascarpone', 90),
    item('Ladyfingers', 70),
    item('Espresso', 30),
    item('Cocoa Powder', 10),
  ]),
  'Margherita Pizza': sigmaWestern([
    item('Pizza Dough', 1),
    item('Pizza Sauce', 70),
    item('Mozzarella Cheese', 120),
    item('Basil', 8),
  ]),
  'Pepperoni Pizza': sigmaWestern([
    item('Pizza Dough', 1),
    item('Pizza Sauce', 70),
    item('Mozzarella Cheese', 120),
    item('Pepperoni', 70),
  ]),
  'Vegetarian Pizza': sigmaWestern([
    item('Pizza Dough', 1),
    item('Pizza Sauce', 70),
    item('Mozzarella Cheese', 120),
    item('Mushroom', 45),
    item('bell pepper', 40),
    item('Tomato', 35),
    item('Onion', 20),
  ]),
  'Four Cheese Pizza': sigmaWestern([
    item('Pizza Dough', 1),
    item('Pizza Sauce', 65),
    item('Mozzarella Cheese', 90),
    item('Feta Cheese', 35),
    item('Swiss Cheese', 30),
    item('Parmesan Cheese', 20),
  ]),
  'BBQ Chicken Pizza': sigmaWestern([
    item('Pizza Dough', 1),
    item('BBQ Sauce', 65),
    item('Mozzarella Cheese', 110),
    item('chicken thigh', 100),
    item('Onion', 20),
  ]),
  'Buffalo Chicken Pizza': sigmaWestern([
    item('Pizza Dough', 1),
    item('Buffalo Sauce', 55),
    item('Mozzarella Cheese', 110),
    item('chicken thigh', 100),
    item('Onion', 20),
  ]),
  'Truffle Mushroom Pizza': sigmaWestern([
    item('Pizza Dough', 1),
    item('Mozzarella Cheese', 120),
    item('Mushroom', 60),
    item('Truffle Oil', 10),
    item('Parmesan Cheese', 20),
  ]),
  'Meat Lovers Pizza': sigmaWestern([
    item('Pizza Dough', 1),
    item('Pizza Sauce', 70),
    item('Mozzarella Cheese', 120),
    item('beef tenderloin', 70),
    item('Pepperoni', 60),
    item('Beef Bacon', 40),
  ]),
  'Chicken Alfredo Pasta': sigmaWestern([
    item('Penne Pasta', 160),
    item('chicken thigh', 120),
    item('Cream', 90),
    item('Parmesan Cheese', 25),
    item('Garlic', 8),
  ]),
  'Pesto Penne Pasta': sigmaWestern([
    item('Penne Pasta', 160),
    item('Basil', 12),
    item('Parmesan Cheese', 25),
    item('Garlic', 8),
    item('olive oil', 12),
  ]),
  'Shrimp Arrabbiata': sigmaWestern([
    item('Penne Pasta', 160),
    item('Shrimp', 120),
    item('Tomato', 70),
    item('Garlic', 8),
    item('Chili Flakes', 6),
  ]),
  'Spaghetti Bolognese': sigmaWestern([
    item('Spaghetti Pasta', 170),
    item('beef tenderloin', 120),
    item('Tomato', 70),
    item('Garlic', 8),
    item('Onion', 35),
  ]),
  'Avocado Quinoa Salad': sigmaWestern([
    item('Avocado', 90),
    item('Quinoa', 120),
    item('Lettuce', 70),
    item('Tomato', 50),
    item('Cucumber', 50),
    item('olive oil', 10),
    item('lemon juice', 12),
  ]),
  'Caesar Salad': sigmaWestern([
    item('Lettuce', 90),
    item('Croutons', 35),
    item('Parmesan Cheese', 25),
    item('Caesar Dressing', 35),
  ]),
  'Greek Salad': sigmaWestern([
    item('Lettuce', 50),
    item('Tomato', 60),
    item('Cucumber', 60),
    item('Feta Cheese', 50),
    item('Onion', 20),
    item('olive oil', 10),
  ]),
  'Grilled Chicken Salad': sigmaWestern([
    item('chicken thigh', 120),
    item('Lettuce', 80),
    item('Tomato', 50),
    item('Cucumber', 50),
    item('olive oil', 10),
  ]),
  'Grilled Chicken Sandwich': sigmaWestern([
    item('Sandwich Bread', 2),
    item('chicken thigh', 120),
    item('Lettuce', 20),
    item('Tomato', 30),
    item('Mayonnaise', 25),
  ]),
  'Philly Cheesesteak': sigmaWestern([
    item('Hoagie Roll', 1),
    item('beef tenderloin', 130),
    item('bell pepper', 40),
    item('Onion', 30),
    item('Mozzarella Cheese', 35),
  ]),
  'Tuna Melt Sandwich': sigmaWestern([
    item('Sandwich Bread', 2),
    item('Tuna', 100),
    item('Cheddar Cheese', 35),
    item('Tomato', 25),
    item('Mayonnaise', 20),
  ]),
  'Turkey Club Sandwich': sigmaWestern([
    item('Sandwich Bread', 3),
    item('Turkey Slices', 90),
    item('Beef Bacon', 35),
    item('Lettuce', 20),
    item('Tomato', 30),
    item('Mayonnaise', 25),
  ]),
  'French Fries': sigmaWestern([
    item('Potato', 180),
  ]),
  'Cheesy Fries': sigmaWestern([
    item('Potato', 180),
    item('Cheddar Cheese', 60),
    item('Jalapeno', 20),
  ]),
  'Onion Rings': sigmaWestern([
    item('Onion', 130),
    item('Breadcrumbs', 45),
  ]),
  'Coleslaw': sigmaWestern([
    item('Cabbage', 100),
    item('Carrot', 45),
    item('Mayonnaise', 30),
  ]),
};

for (const [dishName, items] of Object.entries(sigmaWesternRecipes)) {
  pushRecipe(sigmaId, dishName, items);
}

function sigmaDrinkRecipe(name) {
  if (name === 'Fresh Lemon Mint') {
    return [
      item('lemon juice', 30),
      item('Mint', 8),
      item('Ice Cube', 6),
      item('sugar syrup', 18),
      item('sparkling water', 180),
    ];
  }

  if (name === 'Iced Coffee') {
    return [
      item('Coffee', 18),
      item('Milk', 180),
      item('Ice Cube', 6),
      item('sugar syrup', 15),
    ];
  }

  if (name === 'Iced Thai Milk Tea') {
    return [
      item('black tea', 18),
      item('Coconut Milk', 160),
      item('Ice Cube', 6),
      item('sugar syrup', 15),
    ];
  }

  if (name === 'Mango Smoothie') {
    return [
      item('Mango', 120),
      item('Milk', 160),
      item('Honey', 15),
      item('Ice Cube', 5),
    ];
  }

  if (name === 'Strawberry Milkshake') {
    return [
      item('Strawberry', 100),
      item('Milk', 180),
      item('Vanilla Ice Cream', 90),
      item('Ice Cube', 4),
    ];
  }

  if (name === 'Yuzu Green Tea Cooler') {
    return [
      item('green tea', 18),
      item('Yuzu Juice', 30),
      item('Honey', 15),
      item('Ice Cube', 6),
      item('sparkling water', 160),
    ];
  }

  if (name === 'House Green Tea Soda') {
    return [
      item('green tea', 18),
      item('Ice Cube', 6),
      item('sparkling water', 180),
      item('sugar syrup', 15),
    ];
  }

  if (name === 'House Black Tea Soda') {
    return [
      item('black tea', 18),
      item('Ice Cube', 6),
      item('sparkling water', 180),
      item('sugar syrup', 15),
    ];
  }

  const greenTeaDrink = name.includes('No.1') || name.includes('1') || name.includes('3') || name.includes('Green');
  const tea = greenTeaDrink ? 'green tea' : 'black tea';
  const items = [item(tea, 18), item('Ice Cube', 6)];

  if (name.includes('Cold Brew')) {
    items.push(item('Honey', 12));
    return items;
  }

  if (name.includes('Milk')) {
    items.push(item('Coconut Milk', 160), item('sugar syrup', 15));
    return items;
  }

  if (name.includes('Lime') || name.includes('Lemon') || name.includes('Spritz') || name.includes('Fizz') || name.includes('Cooler') || name.includes('Sparkling')) {
    items.push(item('Lime Juice', 25));
  }

  items.push(item('sparkling water', 180));

  if (name.includes('Reserve')) {
    items.push(item('Honey', 12));
  } else {
    items.push(item('sugar syrup', 15));
  }

  return items;
}

const sigmaDrinks = [
  'Cold Brew Tea No.1',
  'Cold Brew Tea No.2',
  'Fresh Lemon Mint',
  'House Black Tea Soda',
  'House Green Tea Soda',
  'Iced Coffee',
  'Iced Thai Milk Tea',
  'Lime Green Tea Fizz',
  'Lime Tea Cooler 1',
  'Lime Tea Cooler 2',
  'Lime Tea Cooler 3',
  'Lime Tea Cooler 4',
  'Mango Smoothie',
  'Sparkling Black Tea Lemon',
  'Strawberry Milkshake',
  'Tea Fizz Reserve 1',
  'Tea Fizz Reserve 2',
  'Tea Fizz Reserve 3',
  'Tea Fizz Reserve 4',
  'Tea Spritz Signature 1',
  'Tea Spritz Signature 2',
  'Tea Spritz Signature 3',
  'Tea Spritz Signature 4',
  'Yuzu Green Tea Cooler',
];

for (const name of sigmaDrinks) {
  pushRecipe(sigmaId, name, sigmaDrinkRecipe(name));
}

const ingredientInserts = [];

for (const restaurantId of [alphaId, sigmaId]) {
  for (const name of [...additions[restaurantId]].sort()) {
    ingredientInserts.push(
      `INSERT INTO ingredients (uuid, restaurant_id, global_ingredient_id, name, stock_unit, current_stock_quantity, low_stock_threshold, target_quantity, unit_cost_cents, average_cost_cents, last_cost_cents, cost_currency, is_active, storage_disk, created_at, updated_at)\n` +
      `SELECT UUID(), ${restaurantId}, NULL, '${sqlEscape(name)}', '${unitFor(name)}', 0.000, 0.000, 0.000, NULL, NULL, NULL, NULL, 1, 'public', NOW(), NOW()\n` +
      `WHERE NOT EXISTS (\n` +
      `  SELECT 1 FROM ingredients WHERE restaurant_id = ${restaurantId} AND name = '${sqlEscape(name)}'\n` +
      `);`
    );
  }
}

const recipeStatements = recipes.flatMap(({ restaurantId, dishName, items }) => {
  const deleteStatement =
    `DELETE di FROM dish_ingredients di\n` +
    `JOIN dishes d ON d.id = di.dish_id\n` +
    `WHERE d.restaurant_id = ${restaurantId} AND d.name = '${sqlEscape(dishName)}';`;

  const inserts = items.map((current, index) =>
    `INSERT INTO dish_ingredients (dish_id, ingredient_id, quantity, unit, order_index, show_in_animation, created_at, updated_at)\n` +
    `SELECT d.id, i.id, ${current.quantity.toFixed(3)}, '${current.unit}', ${index}, 1, NOW(), NOW()\n` +
    `FROM dishes d\n` +
    `JOIN ingredients i ON i.restaurant_id = d.restaurant_id AND i.name = '${sqlEscape(current.name)}'\n` +
    `WHERE d.restaurant_id = ${restaurantId} AND d.name = '${sqlEscape(dishName)}';`
  );

  return [deleteStatement, ...inserts];
});

const sql = [
  'START TRANSACTION;',
  '-- Added ingredients',
  ...ingredientInserts,
  '-- Dish ingredient refresh',
  ...recipeStatements,
  'COMMIT;',
  '',
].join('\n\n');

const report = {
  addedIngredients: {
    Alpha: [...additions[alphaId]].sort(),
    Sigma: [...additions[sigmaId]].sort(),
  },
  recipeCount: recipes.length,
};

const root = path.resolve(process.cwd());
fs.writeFileSync(path.join(root, 'backups', 'demo_ingredient_fix.sql'), sql);
fs.writeFileSync(path.join(root, 'backups', 'demo_ingredient_fix_report.json'), JSON.stringify(report, null, 2));

console.log(`Generated SQL for ${recipes.length} recipe patterns.`);
console.log(`Alpha new ingredients: ${report.addedIngredients.Alpha.length}`);
console.log(`Sigma new ingredients: ${report.addedIngredients.Sigma.length}`);
