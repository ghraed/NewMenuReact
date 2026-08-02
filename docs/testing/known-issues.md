# Known Issues

Date: Sunday, August 2, 2026

## Confirmed Launch Blockers

1. Mobile lint is red.
   - `npm run lint` in `MenuScanApp`
   - Result: `11` errors and `3` warnings.
   - The review could not edit the mobile repository because it is outside the writable workspace and already contains unrelated uncommitted changes.

2. Dependency audits are incomplete.
   - Frontend npm, backend Composer, and mobile npm audits require explicit approval to submit dependency metadata to public registries.
   - No vulnerability counts are available.

3. The room-plan/reservation E2E remains skipped.
   - `tests/e2e/room-plan-reservations.spec.ts`
   - Requires running backend APIs and seeded admin credentials.

4. Critical transactional performance testing is incomplete.
   - A seeded local public-menu API benchmark was attempted at `50` and `20` concurrent requests, but the PHP development server produced no valid ApacheBench summary.
   - No seeded staging target was available.
   - `k6` and `artillery` are not installed.
   - The completed ApacheBench check covered static frontend HTML only.

5. Local development data requires recovery.
   - A stale generated Laravel config cache caused an intermediate backend test run to use `restaurantdb` instead of `restaurantdb_test`.
   - Laravel's test database refresh emptied the local database.
   - Current local counts: `0` users, `0` restaurants, `0` orders.
   - A PHPUnit bootstrap guard now clears generated config cache before tests.
   - No restore was attempted because available SQL dumps are older and restoration requires explicit approval.

## Critical and High Risks

1. Mobile Android build validation is incomplete.
   - The Gradle wrapper requires an external Gradle distribution download.
   - The build was stopped pending explicit authorization.

2. Dependency vulnerability posture is unknown.

3. Frontend production bundle is oversized.
   - `npm run build` passed.
   - `dist/assets/index-q9MPttlP.js`: `2,320.01 kB` minified.
   - `dist/assets/three-BKLwnFPR.js`: `759.64 kB` minified.

4. Production configuration artifacts remain committed.
   - `Menu_React/.env.production`
   - `Menu_API/.env.production`
   - `google-services.json`
   - This review did not prove a plaintext production secret leak; human secret/config review is still required.

## Medium Risks

1. Frontend lint passes with `16` React hook dependency warnings.

2. Frontend unit tests pass but emit React `act(...)` warnings in `tests/unit/adminStaffSchedulingPage.test.tsx`.

3. No frontend, backend, or mobile coverage report was generated.

4. PHPStan/Psalm semantic analysis is not configured.

5. Browser coverage is limited to Chromium desktop.

## Cleared In This Pass

1. Frontend lint errors.
   - Before: `52` errors and `17` warnings.
   - After: `0` errors and `16` warnings; command exits successfully.

2. Guest order browser E2E.
   - Passes guest unlock, cart, submit, idempotency-key, and progressed-order assertions.
   - Captured browser console/page errors: `0`.
   - Service workers are blocked in API-mocked Playwright contexts to prevent cached tenant data from bypassing route mocks.

3. Backend style gate.
   - `./vendor/bin/pint --test`
   - Passed: `353` files.

4. Backend functional suite.
   - Passed: `242` tests and `2,907` assertions against `restaurantdb_test`.
   - Focused reservation, inventory, and order-lifecycle run also passed: `50` tests and `346` assertions.

5. Backend syntax and package-manifest validation.
   - PHP syntax passed for `349` files.
   - `composer validate --strict --no-check-publish` passed.

6. Production backend validation.
   - Production config cache passed.
   - Production route cache passed.
   - Production Docker Compose config passed.

7. Migration validation.
   - Migration status passed.
   - A clean `migrate:fresh` passed for all migrations against `restaurantdb_test`.

8. Frontend build, type checking, and unit tests.
   - Build passed.
   - Type checking passed.
   - `23` unit-test files and `72` tests passed.

9. Mobile tests and type checking.
   - `4` Jest suites and `20` tests passed.
   - Type checking passed.

## Skipped Tests

1. Frontend E2E
   - `tests/e2e/room-plan-reservations.spec.ts`
   - Stated reason: running backend APIs and seeded admin credentials are required.

2. Backend conditional skip paths reviewed in source
   - `tests/Feature/Finance/InvoicePdfDownloadTest.php`
     - Invoice PDF tooling may be unavailable.
   - `tests/Feature/NotificationDeliveryServicesTest.php`
     - OpenSSL may be unavailable or unable to generate/export an FCM test key.
   - The final backend run reported `242` passing tests and did not report an executed skip.

3. Mobile Jest
   - No skipped tests were reported.

## TODO / FIXME Review

1. `Menu_API/tests/Feature/Finance/FinanceParityTest.php`
   - `TODO: Replace with your real service call.`
   - Test debt; not a direct production-code blocker by itself.

No other reviewed TODO/FIXME item was classified as an unresolved launch blocker.

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
