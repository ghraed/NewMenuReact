# Inventory Integrity Review

Date: Wednesday, July 29, 2026.

Scope reviewed in this pass:
- ingredient and stock API behavior
- recipe ownership and edit behavior
- order-time inventory deduction and restoration
- idempotency for repeat processing
- MySQL locking behavior during deduction

## Deduction Lifecycle

Implemented lifecycle:
- Pending order creation does not deduct stock.
- Staff order confirmation is the primary deduction point.
- POS checkout creates a confirmed order, runs deduction inside the same transaction, then advances the order to accounted.
- Cancelling a previously confirmed order restores stock from persisted usage snapshots and direct packaged-sale movements.

Verified on Wednesday, July 29, 2026:
- `tests/Feature/OrderInventoryDeductionTest.php`
- `tests/Feature/InventoryIngredientApiTest.php`
- `tests/Feature/DishManagementApiTest.php`
- `tests/Feature/InventoryConcurrencyTest.php`

Covered behaviors:
- deduction after confirmation
- no deduction before confirmation
- multiple dish quantities
- multiple ingredients
- shared-ingredient aggregation across multiple order items
- cancelled-order restoration
- failed POS order creation rollback
- insufficient stock rejection
- negative-stock prevention
- stock-history quantity-before and quantity-after accuracy

## Idempotency Mechanism

Current implementation:
- `OrderInventoryDeductionService::deductForConfirmedOrder()` locks the order row and returns early when usage snapshots or completed consumption movements already exist.
- `OrderInventoryDeductionService::restoreForCancelledOrder()` locks the order row and returns early when the expected restoration movements already exist.
- `order_item_ingredient_usages` has a unique key on `(order_item_id, ingredient_id)`.
- confirmation and cancellation endpoints both re-check order status inside the transaction before mutating.

Verified protections:
- retrying the deduction service for the same confirmed order does not deduct twice
- retrying the restoration service for the same cancelled order does not restore twice
- replaying the confirm endpoint for the same order returns `422` and does not create extra usage or stock movements
- cancelling the same order twice does not restore twice

Launch-blocking duplicate-deduction assessment:
- No duplicate-deduction defect was reproduced in the current covered paths.
- The active automated coverage treats duplicate or partial deduction as a blocking integrity issue.

## Concurrency Behavior

Actual mechanism:
- deduction and restoration both use MySQL `lockForUpdate()` on the order row
- deduction also locks all affected ingredient rows before checking available stock and writing movements
- restock and manual adjustment endpoints lock the ingredient row before changing quantity

Verified behavior:
- when another transaction holds the target ingredient row lock, order confirmation fails and the outer transaction rolls back
- after that lock-contention failure, the order remains pending, ingredient quantities remain unchanged, and no usage snapshots or stock movements are written
- when two separate orders compete for the same ingredient quantity, the first confirmation succeeds and the second is rejected once stock is no longer sufficient

Concurrency test note:
- the lock-path test required real migrations instead of the normal transaction-wrapped test mode, which also surfaced and justified fixes to two migration rollback paths in `Menu_API`

## Remaining Risks

Product gaps or behavior not implemented as first-class automated surfaces:
- Ingredient deletion is not implemented as an inventory API action. The system currently supports activation and deactivation, not hard-delete inventory management through the tested API surface.
- Unit conversion is not implemented. The current policy is exact-unit matching plus blocking unsafe unit changes for ingredients already referenced by recipes.
- There is no explicit low-stock warning emitted in the order confirmation response. Low stock is currently exposed through inventory ingredient state such as `is_low_stock`.
- Queue-specific duplicate job execution is covered by service-level idempotency rather than by a dedicated queue middleware or dedupe table.
- Real simultaneous success-path processing of two order confirmations against the same ingredient was not executed in parallel threads or processes; the current concurrency proof is row-lock rollback under contention plus first-wins/second-rejects stock exhaustion coverage.
- No dedicated automated coverage exists yet for concurrent restock plus deduction races, or concurrent manual adjustments against the same ingredient.

## Targeted Results

Executed on Wednesday, July 29, 2026:
- `php artisan test tests/Feature/InventoryIngredientApiTest.php tests/Feature/DishManagementApiTest.php tests/Feature/OrderInventoryDeductionTest.php`
  Result: 21 passing tests, 181 assertions, 0 failures
- `php artisan test tests/Feature/InventoryConcurrencyTest.php`
  Result: 1 passing test, 5 assertions, 0 failures

Total for this pass:
- 22 passing tests
- 186 assertions
- 0 failures
