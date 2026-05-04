# Finance Backend Spec (Phase 0-1)

This frontend workspace cannot directly modify the Laravel backend repository, so this file captures the implementation contract to build there with strict correctness controls.

## Quality Rules

1. Store money in integer cents (`*_cents`), never float.
2. Use database transactions for all accounting state changes.
3. Enforce idempotency keys on create/finalize financial writes.
4. Centralize calculations in backend domain services.
5. Exclude `void/cancelled` records from financial totals unless explicitly requested.

## Schema Additions

### `expense_categories`
- `id`, `restaurant_id`, `code`, `name`, `is_active`, timestamps
- unique: `(restaurant_id, code)`

### `vendors`
- `id`, `restaurant_id`, `name`, `contact_name`, `phone`, `email`, `tax_number`, `notes`, `is_active`, timestamps

### `expenses`
- `id`, `restaurant_id`, `category_id`, `vendor_id`
- `expense_date`, `amount_cents`, `tax_amount_cents`, `currency`
- `status` (`draft|approved|paid|void`)
- `payment_method`, `reference_no`, `description`, `notes`, `due_date`, `paid_at`
- `created_by`, `approved_by`, soft delete + timestamps
- indexes: `(restaurant_id, expense_date)`, `(restaurant_id, status)`

### `expense_attachments`
- `id`, `expense_id`, `file_url`, `file_name`, `mime_type`, `file_size`, timestamps

### Inventory Cost Fields
Add to `inventory_ingredients`:
- `unit_cost_cents`, `average_cost_cents`, `last_cost_cents`, `cost_currency`

Add to `inventory_stock_movements`:
- `unit_cost_cents`, `total_cost_cents`

## API Contracts

### `GET /admin/finance/expenses`
Filters: `date_from`, `date_to`, `status`, `category_id`, `vendor_id`, `page`, `per_page`

### `POST /admin/finance/expenses`
Create expense with cents fields and status validation.

### `PATCH /admin/finance/expenses/{id}`
Update mutable fields; `paid` requires `paid_at`.

### `GET /admin/finance/pnl`
Params: `date_from`, `date_to`, `group_by=daily|monthly|yearly`
Return totals:
- `revenue_cents`
- `cogs_cents`
- `gross_profit_cents`
- `operating_expenses_cents`
- `net_profit_cents`

### `GET /admin/finance/tax/summary`
Params: `date_from`, `date_to`
Return:
- `taxable_sales_cents`
- `output_vat_cents`
- `input_vat_cents`
- `net_vat_payable_cents`

### `GET /admin/finance/dashboard`
Return KPI cards for revenue, expenses, gross/net profit, payable tax, invoice count.

## Required Backend Tests

1. Unit tests for P&L formulas and VAT formulas.
2. Unit tests for all rounding behavior to cents.
3. API validation tests for all finance endpoints.
4. Status transition tests (`draft -> approved -> paid`, void behavior).
5. Idempotency tests on expense creation/finalization.
6. Regression fixture tests with known monthly totals.
