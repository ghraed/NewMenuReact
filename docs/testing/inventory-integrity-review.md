# Inventory Integrity Review

Date: Wednesday, July 29, 2026.

Status: Implemented for the current reviewed checklist, with a few explicit remaining risks noted below.

## Deduction Lifecycle

Current implemented lifecycle:
- Guest order creation creates `pending_staff_confirmation` orders and does not deduct stock.
- Staff confirmation at `POST /api/orders/{order}/confirm` is the primary recipe-stock deduction point.
- POS checkout confirms, deducts, and then accounts the order in one transaction.
- Cancelling a confirmed order restores stock from persisted usage snapshots and direct packaged-sale movements.
- Cancelling a still-pending order does not deduct or restore inventory.

Verified on Wednesday, July 29, 2026:
- `php artisan test tests/Feature/InventoryIngredientApiTest.php tests/Feature/DishManagementApiTest.php tests/Feature/OrderInventoryDeductionTest.php tests/Feature/InventoryConcurrencyTest.php tests/Feature/OrderWorkflowTest.php tests/Feature/InventoryContractsTest.php`
- Result: 54 passing tests, 432 assertions, 0 failures

Checklist coverage verified in code and tests:
- Ingredients and stock:
  - ingredient creation
  - editing
  - deletion
  - stock addition
  - stock adjustment
  - waste
  - purchase entry
  - stock history
  - units
  - decimal quantities
  - unit conversion for stock mutations
  - invalid unit
  - negative quantity
  - extremely large quantity
  - tenant isolation
- Recipes:
  - assign ingredients to dish
  - edit recipe
  - remove ingredient
  - duplicate ingredient rejection
  - decimal consumption
  - missing ingredient rejection
  - deleted ingredient rejection
  - recipe belonging to another restaurant rejection
  - recipe change after existing orders
- Order deduction:
  - deduction after confirmed order
  - deduction at the actual implemented lifecycle stage
  - multiple dish quantities
  - multiple ingredients
  - cancelled order restoration
  - rejected-order equivalent via pending cancellation without deduction
  - failed order creation rollback
  - transaction rollback
  - duplicate request protection
  - duplicate queue-job / retried-job / replayed-event equivalent via repeated service invocation
  - same order processed twice
  - insufficient stock
  - negative-stock prevention
  - concurrent orders consuming the same ingredient
  - low-stock warning
  - stock history accuracy

## Idempotency Mechanism

Current protections:
- `OrderInventoryDeductionService::deductForConfirmedOrder()` locks the order row and returns early when completed usage snapshots or valid consumption movements already exist.
- `order_item_ingredient_usages` is written with `upsert()` on `(order_item_id, ingredient_id)`.
- `OrderInventoryDeductionService::restoreForCancelledOrder()` locks the order and returns early when matching restore movements already exist.
- A duplicate confirm request does not deduct twice because the second request sees a non-pending order.
- POS checkout now supports idempotent replay through `X-Idempotency-Key`, preventing duplicate checkout deductions for the same request payload.
- Guest order creation already had its own idempotent replay path.

Verified idempotency behaviors:
- retrying the same deduction service call does not deduct twice
- replaying the same service-trigger path does not deduct twice
- repeating the same cancellation restore path does not restore twice
- duplicate confirm requests do not deduct twice
- duplicate POS checkout requests with the same idempotency key do not create or deduct twice

## Concurrency Behavior

Actual mechanism:
- confirmation locks the order row
- deduction locks all affected ingredient rows before stock checks and movement writes
- restock and manual adjustment also lock the ingredient row before mutation

Verified concurrency behaviors:
- if another transaction holds the ingredient row lock, confirmation fails and the whole order confirmation rolls back cleanly
- after lock-contention failure, the order stays pending, stock remains unchanged, and no usage snapshots or stock movements are written
- when two orders compete for the same ingredient stock, the first confirmation succeeds and the second is rejected once stock is no longer sufficient

## Remaining Risks

- The concurrency suite proves rollback under real row-lock contention, but it does not run a true parallel success-path double-confirmation race with separate worker processes both attempting to commit at the same instant.
- Queue and event replay safety is proven at the service level by repeated invocations, not by a dedicated queued deduction worker or event-consumer implementation, because the current project performs deduction inline rather than through a separate inventory queue.
- The product does not currently have a separate `rejected` order status; the tested no-deduction rejection-equivalent path is cancellation while the order is still pending.
- Unit conversion is currently implemented for stock mutation inputs such as restock and manual adjustment; recipes still store and consume in the ingredient stock base unit.
