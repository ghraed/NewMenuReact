# Known Issues

Date: Thursday, July 30, 2026

## Confirmed Launch Blockers

1. Frontend lint is red.
   Evidence:
   - `npm run lint`
   - Result: `52 errors`, `17 warnings`
   - Highest-risk errors include conditional hook-order violations in [`src/components/ChatBot.tsx`](/media/raed/Data/from%20ubuntu/new_menu/Menu_React/src/components/ChatBot.tsx:575) and synchronous state-in-effect violations in guest/admin UI components.

2. The guest order browser flow is still failing.
   Evidence:
   - `env PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173 npm run test:e2e`
   - First run failed because Chromium could not launch in the sandbox.
   - Escalated rerun failed in `tests/e2e/guest-order-lifecycle.spec.ts`.
   - Latest targeted rerun:
     - `env PLAYWRIGHT_BASE_URL=http://127.0.0.1:4174 npm run test:e2e -- --grep "Guest order lifecycle"`
     - still failed after reaching `Review Your Order`
     - snapshot showed stale `Alpha` cart/session state instead of the mocked `Cedar Flame` flow

3. Backend static analysis/style is red.
   Evidence:
   - `./vendor/bin/pint --test`
   - Result: `141 style issues` across `353 files`

4. Mobile lint is red.
   Evidence:
   - `npm run lint` in `MenuScanApp`
   - Result: `11 errors`, `3 warnings`

5. Migration validation is incomplete.
   Evidence:
   - `php artisan migrate:status --env=testing`
   - Failure:
     - `SQLSTATE[HY000] [2002] Unknown error while connecting`
     - target DB: `restaurantdb_test` on `127.0.0.1:3306`

6. Dependency audits are incomplete.
   Evidence:
   - Attempted:
     - `composer audit --format=json`
     - `npm audit --omit=dev --json` in `Menu_React`
     - `npm audit --omit=dev --json` in `MenuScanApp`
   - Each attempt was blocked pending explicit approval to submit dependency metadata to a public registry service.

## Critical and High Risks

1. Clean browser-console review is incomplete.
   Evidence:
   - no browser E2E run completed cleanly end-to-end
   - therefore no clean browser-console pass was collected

2. Frontend production bundle is oversized.
   Evidence:
   - `npm run build`
   - Warning:
     - `dist/assets/index-Co199srk.js` minified size `2,319.75 kB`
     - `dist/assets/three-BKLwnFPR.js` minified size `759.64 kB`

3. Frontend unit tests still emit React warning noise.
   Evidence:
   - `npm run test:unit`
   - Result: passed (`23 files`, `72 tests`)
   - Warning emitted:
     - React `act(...)` warnings in `tests/unit/adminStaffSchedulingPage.test.tsx`

4. Mobile Android build validation is still incomplete.
   Evidence:
   - `GRADLE_USER_HOME=/tmp/menuscanapp-gradle ./gradlew :app:assembleDebug`
   - Failure:
     - Gradle bootstrap download blocked by `java.net.SocketException: Operation not permitted`

5. Production config artifacts are committed and should be reviewed before launch.
   Evidence:
   - [`Menu_React/.env.production`](/media/raed/Data/from%20ubuntu/new_menu/Menu_React/.env.production:1)
   - [`Menu_API/.env.production`](/media/raed/Data/from%20ubuntu/new_menu/Menu_API/.env.production:1)
   - [`google-services.json`](/media/raed/Data/from%20ubuntu/new_menu/google-services.json:1)
   - This pass did not prove a plaintext production secret leak, but these files remain sensitive.

## Backend Status Cleared In This Pass

1. Backend functional suite is green.
   Evidence:
   - `php artisan test`
   - Result: passed
   - Passing: `242 tests`
   - Assertions: `2907`

2. Host-based tenant routing targeted suite is green.
   Evidence:
   - `php artisan test --filter='TenantDomainRoutingTest'`
   - Result: passed (`6 tests`, `19 assertions`)

3. Production-style backend cache commands are green.
   Evidence:
   - `php artisan config:cache`
   - `php artisan route:cache`
   - both passed

## Skipped Tests

1. Frontend E2E
   - `tests/e2e/room-plan-reservations.spec.ts`
   - Stated reason in test:
     - running backend APIs and seeded admin credentials are required

2. Backend conditional skip paths reviewed in source
   - [`tests/Feature/Finance/InvoicePdfDownloadTest.php`](/media/raed/Data/from%20ubuntu/new_menu/Menu_API/tests/Feature/Finance/InvoicePdfDownloadTest.php:283)
     - `Invoice PDF tooling is not installed in this environment.`
   - [`tests/Feature/NotificationDeliveryServicesTest.php`](/media/raed/Data/from%20ubuntu/new_menu/Menu_API/tests/Feature/NotificationDeliveryServicesTest.php:117)
     - `OpenSSL is required for mobile push notification tests.`
   - [`tests/Feature/NotificationDeliveryServicesTest.php`](/media/raed/Data/from%20ubuntu/new_menu/Menu_API/tests/Feature/NotificationDeliveryServicesTest.php:263)
     - `Failed to generate an OpenSSL private key for the FCM test.`
   - [`tests/Feature/NotificationDeliveryServicesTest.php`](/media/raed/Data/from%20ubuntu/new_menu/Menu_API/tests/Feature/NotificationDeliveryServicesTest.php:269)
     - `Failed to export an OpenSSL private key for the FCM test.`

3. Mobile Jest
   - No skipped mobile Jest tests were reported in the collected run.

## TODO / FIXME Review

1. [`Menu_API/tests/Feature/Finance/FinanceParityTest.php`](/media/raed/Data/from%20ubuntu/new_menu/Menu_API/tests/Feature/Finance/FinanceParityTest.php:38)
   - `TODO: Replace with your real service call.`
   - Classification:
     - test debt only
     - not a direct production-code blocker by itself

## Testing Documents Reviewed

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
- `docs/testing/launch-readiness-report.md`
