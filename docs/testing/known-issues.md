# Known Issues

Date: Wednesday, July 29, 2026

## Confirmed Launch Blockers

1. Host-based tenant isolation is not proven safe.
   Evidence:
   - `php artisan test --filter='TenantDomainRoutingTest'`
   - Failing tests:
     - `unknown host returns not found for host based guest routes`
     - `table context and guest orders are isolated per host tenant`
   - The test currently receives `testing.local` unless server host variables are forced, and even after correcting the test harness the suite still failed on those two isolation assertions.

2. The backend suite is not green.
   Evidence:
   - Earlier full run: `php artisan test` -> `219 passed`, `23 failed`, `2775 assertions`
   - Several targeted regressions were fixed and rerun green:
     - `AssetFileControllerTest`
     - `GlobalIngredientControllerTest`
     - `GuestTableVisibilityTest`
     - `InventoryIngredientImportTest`
     - `SharedProductFlowTest`
     - `StaffManagementTest`
   - A fresh full-suite rerun was not completed after all fixes, so there is still no passing backend test baseline for launch.

3. Finance behavior is still not cleared for launch.
   Evidence:
   - Earlier full run failures included:
     - `FinancePayrollApiTest`
     - `FinanceProfitLossApiTest`
     - `FinanceTaxReportApiTest`
   - I patched likely causes in payroll period creation, profit/loss `expense_status`, and tax-report VAT fallback logic.
   - Follow-up finance reruns were started in parallel by mistake and became invalid due MySQL test-database migration contention, so there is still no clean passing finance rerun.

4. Production-sensitive configuration remains committed.
   Evidence:
   - [`Menu_React/.env.production`](/media/raed/Data/from ubuntu/new_menu/Menu_React/.env.production:1)
   - [`Menu_API/.env.production`](/media/raed/Data/from ubuntu/new_menu/Menu_API/.env.production:1)
   - [`google-services.json`](/media/raed/Data/from ubuntu/new_menu/google-services.json:1)

5. Dependency/security posture is still red.
   Evidence:
   - `composer audit` reported `31 advisories` across `12 packages`
   - High-severity examples included `laravel/framework`, `symfony/http-kernel`, `symfony/mime`, `web-token/jwt-library`

## High Risks

1. Frontend feature bypass for a hardcoded email.
   Evidence:
   - [`src/utils/features.ts`](/media/raed/Data/from ubuntu/new_menu/Menu_React/src/utils/features.ts:1) grants full feature access to `admin@alpha.com`.

2. Frontend and mobile lint remain red.
   Evidence:
   - Frontend: `npm run lint` -> `52 errors`, `17 warnings`
   - Mobile: `npm run lint` in `MenuScanApp` -> `11 errors`, `3 warnings`

3. Browser/runtime coverage is incomplete.
   Evidence:
   - Playwright only covered Chromium / desktop guest ordering.
   - `tests/e2e/room-plan-reservations.spec.ts` remained skipped.

4. Performance evidence is missing.
   Evidence:
   - `which k6` -> not found
   - `which artillery` -> not found
   - No valid performance run completed.

5. Migration/ops validation is inconsistent.
   Evidence:
   - `php artisan optimize` passed
   - `php artisan optimize:clear` failed against the DB-backed cache
   - `php artisan migrate:fresh --env=testing` previously failed to connect to `restaurantdb_test`

## Fixed In This Pass

1. Frontend payroll negative-net validation.
   Evidence:
   - `npm run test:unit -- --run tests/unit/adminPayrollManagementPage.test.tsx`
   - Result: passed (`3 tests`)

2. Public asset streaming and several guest/inventory compatibility regressions.
   Evidence:
   - `php artisan test --filter='AssetFileControllerTest|GuestTableVisibilityTest|GlobalIngredientControllerTest|InventoryIngredientImportTest|SharedProductFlowTest|StaffManagementTest|TenantDomainRoutingTest'`
   - Passing suites in that run:
     - `AssetFileControllerTest`
     - `GlobalIngredientControllerTest`
     - `GuestTableVisibilityTest`
     - `InventoryIngredientImportTest`
     - `SharedProductFlowTest`
     - `StaffManagementTest`
   - Remaining failures in that run:
     - `TenantDomainRoutingTest`

## Skipped Tests

1. Frontend E2E
   - `tests/e2e/room-plan-reservations.spec.ts`
   - Stated reason in test: seeded backend APIs and admin credentials are required.

2. Backend
   - No skipped backend tests were reported in the original full-suite run.

3. Mobile
   - No skipped mobile Jest tests were reported.

## TODO / FIXME Review

1. [`Menu_API/tests/Feature/Finance/FinanceParityTest.php`](/media/raed/Data/from ubuntu/new_menu/Menu_API/tests/Feature/Finance/FinanceParityTest.php:38)
   - `TODO: Replace with your real service call.`

2. [`docs/backend/FinanceParityTest.php.example`](/media/raed/Data/from ubuntu/new_menu/Menu_React/docs/backend/FinanceParityTest.php.example:38)
   - Example-file TODO only.

## Testing Docs Reviewed

- `docs/testing/auth-and-tenancy-review.md`
- `docs/testing/feature-test-matrix.md`
- `docs/testing/finance-consistency-review.md`
- `docs/testing/inventory-integrity-review.md`
- `docs/testing/invoice-calculation-review.md`
- `docs/testing/manual-regression-checklist.md`
- `docs/testing/order-lifecycle-defects.md`
- `docs/testing/performance-results.md`
- `docs/testing/security-review.md`
- `docs/testing/test-environment.md`
- `docs/testing/test-strategy.md`
