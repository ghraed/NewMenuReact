-- rozer.pro targeted inventory restock
-- Generated from live production inspection on 2026-06-22
-- Restaurant: Alpha / slug=rozer / custom_domain=rozer.pro / restaurant_id=46
--
-- Current state before restock:
-- - 40 active published dishes
-- - only 3 orderable: Fresh Lemon Mint, Greek Salad, Grilled Chicken Salad
--
-- Goal:
-- - bring the restaurant to about 60% menu availability
-- - target 24 orderable dishes total
--
-- Dishes this restock is intended to make orderable:
-- Existing 3:
--   Fresh Lemon Mint
--   Greek Salad
--   Grilled Chicken Salad
-- Additional 21:
--   Avocado Quinoa Salad
--   Caesar Salad
--   Mozzarella Sticks
--   Loaded Nachos
--   Garlic Bread
--   French Fries
--   Cheesy Fries
--   Onion Rings
--   Coleslaw
--   Chicken Alfredo Pasta
--   Spaghetti Bolognese
--   Pesto Penne Pasta
--   Shrimp Arrabbiata
--   Classic Beef Burger
--   Crispy Chicken Burger
--   Grilled Chicken Sandwich
--   Margherita Pizza
--   Pepperoni Pizza
--   Iced Coffee
--   Strawberry Milkshake
--   Mango Smoothie
--
-- Notes:
-- - This script updates only live inventory rows for restaurant_id=46.
-- - It uses GREATEST(...) so it will never reduce existing stock.
-- - It does not touch deleted dishes or add new dishes.

START TRANSACTION;

UPDATE ingredients
SET current_stock_quantity = GREATEST(current_stock_quantity, 2500.000),
    updated_at = NOW()
WHERE restaurant_id = 46 AND id = 4307 AND name = 'Avocado';

UPDATE ingredients
SET current_stock_quantity = GREATEST(current_stock_quantity, 1200.000),
    updated_at = NOW()
WHERE restaurant_id = 46 AND id = 4310 AND name = 'Basil';

UPDATE ingredients
SET current_stock_quantity = GREATEST(current_stock_quantity, 2500.000),
    updated_at = NOW()
WHERE restaurant_id = 46 AND id = 4313 AND name = 'Breadcrumbs';

UPDATE ingredients
SET current_stock_quantity = GREATEST(current_stock_quantity, 24.000),
    updated_at = NOW()
WHERE restaurant_id = 46 AND id = 4309 AND name = 'Baguette';

UPDATE ingredients
SET current_stock_quantity = GREATEST(current_stock_quantity, 2500.000),
    updated_at = NOW()
WHERE restaurant_id = 46 AND id = 4317 AND name = 'Butter';

UPDATE ingredients
SET current_stock_quantity = GREATEST(current_stock_quantity, 5000.000),
    updated_at = NOW()
WHERE restaurant_id = 46 AND id = 4318 AND name = 'Cabbage';

UPDATE ingredients
SET current_stock_quantity = GREATEST(current_stock_quantity, 3000.000),
    updated_at = NOW()
WHERE restaurant_id = 46 AND id = 4320 AND name = 'Carrot';

UPDATE ingredients
SET current_stock_quantity = GREATEST(current_stock_quantity, 3000.000),
    updated_at = NOW()
WHERE restaurant_id = 46 AND id = 4319 AND name = 'Caesar Dressing';

UPDATE ingredients
SET current_stock_quantity = GREATEST(current_stock_quantity, 5000.000),
    updated_at = NOW()
WHERE restaurant_id = 46 AND id = 4321 AND name = 'Cheddar Cheese';

UPDATE ingredients
SET current_stock_quantity = GREATEST(current_stock_quantity, 800.000),
    updated_at = NOW()
WHERE restaurant_id = 46 AND id = 4323 AND name = 'Chili Flakes';

UPDATE ingredients
SET current_stock_quantity = GREATEST(current_stock_quantity, 2500.000),
    updated_at = NOW()
WHERE restaurant_id = 46 AND id = 4326 AND name = 'Coffee';

UPDATE ingredients
SET current_stock_quantity = GREATEST(current_stock_quantity, 5000.000),
    updated_at = NOW()
WHERE restaurant_id = 46 AND id = 4327 AND name = 'Cream';

UPDATE ingredients
SET current_stock_quantity = GREATEST(current_stock_quantity, 2000.000),
    updated_at = NOW()
WHERE restaurant_id = 46 AND id = 4329 AND name = 'Croutons';

UPDATE ingredients
SET current_stock_quantity = GREATEST(current_stock_quantity, 36.000),
    updated_at = NOW()
WHERE restaurant_id = 46 AND id = 4316 AND name = 'Burger Bun';

UPDATE ingredients
SET current_stock_quantity = GREATEST(current_stock_quantity, 1800.000),
    updated_at = NOW()
WHERE restaurant_id = 46 AND id = 4335 AND name = 'Jalapeno';

UPDATE ingredients
SET current_stock_quantity = GREATEST(current_stock_quantity, 4000.000),
    updated_at = NOW()
WHERE restaurant_id = 46 AND id = 4337 AND name = 'Mango';

UPDATE ingredients
SET current_stock_quantity = GREATEST(current_stock_quantity, 4000.000),
    updated_at = NOW()
WHERE restaurant_id = 46 AND id = 4339 AND name = 'Mayonnaise';

UPDATE ingredients
SET current_stock_quantity = GREATEST(current_stock_quantity, 7000.000),
    updated_at = NOW()
WHERE restaurant_id = 46 AND id = 4340 AND name = 'Milk';

UPDATE ingredients
SET current_stock_quantity = GREATEST(current_stock_quantity, 9000.000),
    updated_at = NOW()
WHERE restaurant_id = 46 AND id = 4341 AND name = 'Mozzarella Cheese';

UPDATE ingredients
SET current_stock_quantity = GREATEST(current_stock_quantity, 3000.000),
    updated_at = NOW()
WHERE restaurant_id = 46 AND id = 4342 AND name = 'Mushroom';

UPDATE ingredients
SET current_stock_quantity = GREATEST(current_stock_quantity, 5000.000),
    updated_at = NOW()
WHERE restaurant_id = 46 AND id = 4343 AND name = 'Onion';

UPDATE ingredients
SET current_stock_quantity = GREATEST(current_stock_quantity, 3000.000),
    updated_at = NOW()
WHERE restaurant_id = 46 AND id = 4344 AND name = 'Parmesan Cheese';

UPDATE ingredients
SET current_stock_quantity = GREATEST(current_stock_quantity, 7000.000),
    updated_at = NOW()
WHERE restaurant_id = 46 AND id = 4345 AND name = 'Penne Pasta';

UPDATE ingredients
SET current_stock_quantity = GREATEST(current_stock_quantity, 3000.000),
    updated_at = NOW()
WHERE restaurant_id = 46 AND id = 4346 AND name = 'Pepperoni';

UPDATE ingredients
SET current_stock_quantity = GREATEST(current_stock_quantity, 36.000),
    updated_at = NOW()
WHERE restaurant_id = 46 AND id = 4347 AND name = 'Pizza Dough';

UPDATE ingredients
SET current_stock_quantity = GREATEST(current_stock_quantity, 6000.000),
    updated_at = NOW()
WHERE restaurant_id = 46 AND id = 4348 AND name = 'Pizza Sauce';

UPDATE ingredients
SET current_stock_quantity = GREATEST(current_stock_quantity, 12000.000),
    updated_at = NOW()
WHERE restaurant_id = 46 AND id = 4350 AND name = 'Potato';

UPDATE ingredients
SET current_stock_quantity = GREATEST(current_stock_quantity, 4000.000),
    updated_at = NOW()
WHERE restaurant_id = 46 AND id = 4351 AND name = 'Quinoa';

UPDATE ingredients
SET current_stock_quantity = GREATEST(current_stock_quantity, 60.000),
    updated_at = NOW()
WHERE restaurant_id = 46 AND id = 4352 AND name = 'Sandwich Bread';

UPDATE ingredients
SET current_stock_quantity = GREATEST(current_stock_quantity, 6000.000),
    updated_at = NOW()
WHERE restaurant_id = 46 AND id = 4353 AND name = 'Spaghetti Pasta';

UPDATE ingredients
SET current_stock_quantity = GREATEST(current_stock_quantity, 3500.000),
    updated_at = NOW()
WHERE restaurant_id = 46 AND id = 4354 AND name = 'Strawberry';

UPDATE ingredients
SET current_stock_quantity = GREATEST(current_stock_quantity, 3000.000),
    updated_at = NOW()
WHERE restaurant_id = 46 AND id = 4357 AND name = 'Tortilla Chips';

UPDATE ingredients
SET current_stock_quantity = GREATEST(current_stock_quantity, 5000.000),
    updated_at = NOW()
WHERE restaurant_id = 46 AND id = 4361 AND name = 'Vanilla Ice Cream';

COMMIT;

-- Validation query:
-- This should return about 24 rows with is_orderable = 1 after the restock.
--
-- SELECT d.id,d.name,
--        MIN(
--          CASE
--            WHEN i.id IS NULL
--              OR i.is_active = 0
--              OR di.unit <> i.stock_unit
--              OR CAST(i.current_stock_quantity AS DECIMAL(12,3)) < CAST(di.quantity AS DECIMAL(12,3))
--            THEN 0
--            ELSE 1
--          END
--        ) AS is_orderable
-- FROM dishes d
-- LEFT JOIN dish_ingredients di ON di.dish_id = d.id
-- LEFT JOIN ingredients i ON i.id = di.ingredient_id
-- WHERE d.restaurant_id = 46
--   AND d.status = 'published'
--   AND d.deleted_at IS NULL
-- GROUP BY d.id, d.name
-- ORDER BY is_orderable DESC, d.name;
