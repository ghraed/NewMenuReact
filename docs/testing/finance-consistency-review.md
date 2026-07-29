# Finance Consistency Review

Date: Wednesday, July 29, 2026

Scope:
- Expenses
- Payroll
- Finance and accounting summaries
- Dashboard total consistency between frontend and API-facing fixtures

## Execution Summary

Frontend targeted run completed on Wednesday, July 29, 2026:
- `npm run test:unit -- --run tests/unit/adminFinanceExpensesPage.test.tsx tests/unit/adminFinanceDashboardPage.test.tsx`
- Result: 2 passing files, 5 passing tests, 0 failures

Backend targeted run completed on Wednesday, July 29, 2026:
- `php artisan test tests/Feature/Finance/FinanceExpenseManagementApiTest.php tests/Feature/Finance/FinancePayrollApiTest.php tests/Feature/Finance/FinanceProfitLossApiTest.php tests/Feature/Finance/FinanceDashboardMetricsApiTest.php`
- Result: 18 passing tests, 5 failing tests, 239 assertions

## Frontend Coverage Added

New unit coverage was added in:
- `tests/unit/adminFinanceExpensesPage.test.tsx`
- `tests/unit/adminFinanceDashboardPage.test.tsx`

The new frontend tests now verify:
- Expense totals on the page are derived from fixture records with independent arithmetic.
- Expense pagination metadata is rendered from API meta values.
- Expense create validation blocks invalid paid submissions when `paid_at` is missing.
- Expense create sends decimal amounts as exact cents payloads.
- Expense edit sends updated cent values and trimmed text fields.
- Category create wiring and vendor create wiring both submit trimmed payloads.
- Dashboard revenue, COGS, operating expenses, payroll, tax, and net profit are validated from fixed paginated fixtures with independent expected totals.
- Dashboard invoice fetching and expense fetching honor explicit date and status filters without hidden frontend defaults.

## Backend Coverage Already Present

Existing Laravel finance suites already cover a substantial part of the requested matrix:

Expenses:
- category CRUD with tenant scoping
- vendor CRUD with tenant scoping
- expense create
- expense update
- status transitions
- list filtering
- unauthorized access rejection
- tenant isolation

Payroll:
- entry upsert
- totals
- rounding through cent-based payloads
- duplicate mirror-expense prevention on repeated paid transitions
- missing employee rejection
- cross-tenant access rejection
- negative net pay rejection
- inactive/non-member employee rejection by validation path
- delete draft but not paid record
- query-generated partial periods, weekly splits, and custom-day splits

Finance and accounting:
- revenue totals
- expense totals
- profit totals
- tax totals
- paid, issued, and cancelled invoice handling
- dashboard previous-period deltas
- draft-expense inclusion mode on dashboard metrics
- unauthorized access rejection
- tenant isolation

## Verified Gaps And Findings

The following requested items are not fully covered or are not currently implemented in the inspected code:

- Expense delete: not implemented in the current React page and no delete expense route was found in `routes/api.php`.
- Expense attachments: the backend model has an attachments relation, but no complete expense-attachment management flow is exposed or covered in the current targeted test pass.
- Frontend expense unauthorized and tenant-isolation behavior: enforced primarily by backend role and tenant tests, not by separate frontend route-level tests in this pass.
- Export permissions: no dedicated finance export-permission coverage was found for the current frontend expenses/dashboard surfaces.
- Timezone boundary reporting: not explicitly covered in the current frontend or targeted backend suites.
- Currency exchange-rate change impact on finance summaries: invoice currency/exchange-rate handling exists elsewhere, but not as a targeted summary-consistency test in this pass.
- Refunded or removed items: only partially covered where invoice/session finalization tests deal with cancelled/zeroed items; no dedicated finance-summary regression test was added in this pass.
- Large dataset stress beyond pagination behavior: targeted frontend coverage validates paginated aggregation logic, not performance-scale datasets.

## Active Backend Failures Found

Five backend finance tests are currently failing and should be treated as real review findings until resolved:

1. `FinancePayrollApiTest::test_admin_can_create_payroll_periods_and_overlaps_are_rejected`
- Current behavior requires `employee_id` when creating a salary record.
- The test expects tenant-level payroll period creation without an employee link.
- Failure response: `422 Employee is required for salary record creation.`

2. `FinancePayrollApiTest::test_adjustment_period_can_be_created_for_paid_regular_period_and_included_in_summary`
- Current behavior rejects adjustment creation when the original period has no linked employee.
- Failure response: `422 Original payroll period has no employee linked.`

3. `FinancePayrollApiTest::test_adjustment_period_validation_rules_are_enforced`
- The test expects an overlap-style validation on `period_start`.
- Current behavior fails earlier on missing original employee linkage for the referenced period.

4. `FinanceProfitLossApiTest::test_profit_and_loss_can_include_draft_expenses_when_requested`
- The endpoint currently returns `mode.expense_status = approved_paid` even when `expense_status=all_non_void` is requested.
- That suggests the requested inclusion mode is ignored or normalized away in the P&L endpoint.

5. `FinanceProfitLossApiTest::test_profit_and_loss_includes_paid_payroll_mirror_expense`
- After marking payroll paid, the P&L endpoint still reports `operating_expenses = 0` instead of the expected payroll-backed operating expense.
- That indicates payroll mirror expenses are not being rolled into the profit/loss summary as expected by the existing test.

## Recommendation

Priority order:
1. Resolve the 3 failing payroll backend tests because they block parts of the requested payroll matrix.
2. Resolve the 2 failing profit/loss backend tests because they directly affect finance-summary consistency.
3. Decide whether expense delete and attachment management are product requirements for this release; they are not complete testable surfaces in the current implementation.
4. Add backend tests for timezone boundaries and exchange-rate-sensitive summary reporting if those are business-critical.

## Current Status

Completed:
- frontend finance consistency tests added and passing
- backend finance suites reviewed and executed
- concrete coverage map and defect list documented

Not completed:
- backend payroll and profit/loss failures are not fixed in this pass
- expense delete and attachment workflows remain incomplete product surfaces
