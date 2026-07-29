# Launch Readiness Report

Date: Wednesday, July 29, 2026

## Executive Conclusion

**NOT READY**

The software is not bug-free. Based only on the evidence collected on July 29, 2026, it should not be launched to a real restaurant client yet.

## Test Evidence

### Frontend

- Command: `npm run lint`
  - Result: failed
  - Summary: `52 errors`, `17 warnings`

- Command: `npx tsc -b`
  - Result: passed

- Command: `npm run test:unit`
  - Earlier result: failed
  - Passing: `22 files`, `71 tests`
  - Failing: `1 file`, `1 test`
  - Failing test:
    - `tests/unit/adminPayrollManagementPage.test.tsx`
      - `AdminPayrollManagementPage > blocks saving entries when net pay would be negative`

- Command: `npm run test:unit -- --run tests/unit/adminPayrollManagementPage.test.tsx`
  - Result after fix: passed
  - Passing: `1 file`, `3 tests`

- Command: `npm run build`
  - Result: passed
  - Warning:
    - Vite chunk-size warning
    - `dist/assets/index-CQJwnXeW.js` minified size `2,319.50 kB`
    - `dist/assets/three-BKLwnFPR.js` minified size `759.64 kB`

- Command: `env PLAYWRIGHT_BASE_URL=http://127.0.0.1:5174 npm run test:e2e`
  - First sandboxed run: Chromium failed to start in the sandbox
  - Escalated rerun: passed
  - Browser: Chromium
  - Viewport: `1280x720`
  - Passing scenario:
    - `tests/e2e/guest-order-lifecycle.spec.ts`
  - Skipped scenario:
    - `tests/e2e/room-plan-reservations.spec.ts`

- Frontend coverage:
  - not available in this run

### Backend

- Command: `php artisan test`
  - Earlier result: failed
  - Passing: `219 tests`
  - Failing: `23 tests`
  - Assertions: `2775`

- Command: `php artisan test --filter='AssetFileControllerTest|GuestTableVisibilityTest|GlobalIngredientControllerTest|InventoryIngredientImportTest|SharedProductFlowTest|StaffManagementTest|TenantDomainRoutingTest'`
  - Result: failed
  - Passing suites:
    - `AssetFileControllerTest`
    - `GlobalIngredientControllerTest`
    - `GuestTableVisibilityTest`
    - `InventoryIngredientImportTest`
    - `SharedProductFlowTest`
    - `StaffManagementTest`
  - Remaining failing suite:
    - `TenantDomainRoutingTest`
      - `unknown host returns not found for host based guest routes`
      - `table context and guest orders are isolated per host tenant`

- Command: `php artisan test --filter='TenantDomainRoutingTest'`
  - Result: failed
  - Passing:
    - `slug routes remain backward compatible even when host is unknown`
    - `host based guest menu resolves to restaurant custom domain column`
    - `host based guest menu resolves www variant of restaurant custom domain`
  - Failing:
    - `host based guest menu resolves to domain restaurant`
    - `unknown host returns not found for host based guest routes`
    - `table context and guest orders are isolated per host tenant`

- Commands started for finance reruns:
  - `php artisan test --filter='FinancePayrollApiTest'`
  - `php artisan test --filter='FinanceProfitLossApiTest'`
  - `php artisan test --filter='FinanceTaxReportApiTest'`
  - Result: invalid / inconclusive
  - Reason: I launched them in parallel against the same MySQL testing database, which caused migration-table contention and made those reruns unusable as evidence.

- Command: `./vendor/bin/pint --test`
  - Result: failed
  - Summary: `140 style issues`

- Command: `find app config database routes tests -name '*.php' -print0 | xargs -0 -n1 -P4 php -l`
  - Result: passed

- Command: `php artisan optimize`
  - Result: passed

- Command: `docker compose -f docker-compose.prod.yml config -q`
  - Result: passed

- Commands: `php artisan config:clear`, `php artisan route:clear`, `php artisan event:clear`, `php artisan view:clear`
  - Result: passed

- Command: `php artisan optimize:clear`
  - Result: failed
  - Failure: could not clear the DB-backed default cache

- Command: `php artisan migrate:fresh --env=testing`
  - Result: failed earlier
  - Failure: `SQLSTATE[HY000] [2002] Unknown error while connecting` to `restaurantdb_test`

- Backend coverage:
  - not available in this run

### Mobile

- Target: `../MenuScanApp`

- Command: `npm test -- --runInBand --no-cache`
  - Result: passed
  - Passing: `4 suites`, `20 tests`

- Command: `npm run lint`
  - Result: failed
  - Summary: `11 errors`, `3 warnings`

- Command: `npx tsc --noEmit`
  - Result: passed

- Command: `GRADLE_USER_HOME=/tmp/gradle-menuscan ./gradlew :app:assembleDebug`
  - Result: inconclusive
  - Reason: Gradle bootstrap/download started, but no compile result was produced before the run was manually stopped

### Dependency Audit

- Command: `composer audit`
  - Result: failed
  - Summary: `31 advisories` across `12 packages`

- Command: `npm audit --omit=dev` in `Menu_API`
  - Result: passed
  - Summary: `0 vulnerabilities`

- Command: `npm audit --omit=dev` in `Menu_React`
  - Result: not collected
  - Reason: network/DNS restriction first, then policy rejection for public-registry metadata submission

- Command: `npm audit --omit=dev` in `MenuScanApp`
  - Result: not collected
  - Reason: network/DNS restriction first, then policy rejection for public-registry metadata submission

### Performance

- Command: `which k6`
  - Result: not found

- Command: `which artillery`
  - Result: not found

- Critical performance tests:
  - no valid performance run completed

## Risk Summary

### Blockers

- Host-based tenant routing/isolation is still failing under test.
- The backend suite is not green.
- Finance behavior has not been re-cleared with a clean rerun.
- Backend lint/static-style gate is red.
- Frontend lint is red.
- Mobile lint is red.
- `composer audit` is red with high-severity advisories.
- Production-sensitive config remains committed in the repository.

### Critical Risks

- Possible unauthorized protected access or cross-tenant leakage remains unresolved because `TenantDomainRoutingTest` still fails.
- Finance reporting touched launch-sensitive areas, but there is still no clean passing evidence for payroll / profit-and-loss / tax reruns.
- No valid performance evidence exists.

### High Risks

- Hardcoded full-access frontend bypass for `admin@alpha.com`.
- Large frontend production bundle with chunk-size warnings.
- `optimize:clear` fails against the DB-backed cache.
- Frontend and mobile npm audit results are missing.

### Medium Risks

- Browser coverage is limited to one Chromium desktop guest-order path.
- Android build validation was attempted but not completed.
- No manual browser/device regression pass was performed.

### Known Limitations

- Playwright required escalation outside the sandbox.
- One E2E scenario remained skipped.
- Coverage reports were not generated.
- Performance tooling was not available.

### Manually Tested Features

- None in this pass.
- This review relied on automated checks and source/doc review.

### Untested Features

- Full host-based multi-tenant browser flows in a real browser session
- Full finance regression verification after the latest backend patches
- Room-plan reservations E2E
- Physical-device mobile flows

### Reason Features Could Not Be Fully Tested

- The tenant-routing test client needed harness correction and still left failures.
- Finance reruns were invalidated by test-database contention.
- One E2E spec requires seeded backend data and credentials.
- Mobile build validation did not complete.
- Public npm audits require explicit approval to submit dependency metadata.

## Pilot Plan

Recommend a controlled pilot only after the blockers above are resolved and this report is rerun.

- Suggested pilot duration: `2 weeks`
- Number of pilot restaurants: `1`
- Features enabled initially:
  - QR menu
  - guest table unlock
  - guest ordering
  - staff confirmation
  - kitchen progression
  - basic invoice generation
- Features disabled initially:
  - finance dashboard
  - payroll management
  - expense management
  - custom-domain onboarding
  - event reservations
  - room-plan editor write access
  - public reservations
- Errors and metrics to monitor:
  - order-create failures
  - idempotency replay rate
  - inventory deduction mismatches
  - invoice-generation failures
  - guest unlock failures
  - 4xx/5xx rate by route
  - browser JS error count
- Logging requirements:
  - structured request logs with tenant, route, status, latency
  - order/invoice/inventory audit logs
  - queue failure logs
  - browser error capture
- Database backup plan:
  - full backup before pilot start
  - nightly backups during pilot
  - pre-deploy backup before every pilot hotfix
- Rollback procedure:
  - disable pilot tenant access
  - restore the last known-good app build
  - restore the pre-change database backup if integrity is affected
  - verify order, invoice, and inventory consistency before reopening
- Support checklist:
  - named on-call owner
  - test admin account
  - pilot contact at restaurant
  - rollback access verified
  - log dashboard available
- Incident-response checklist:
  - identify the affected tenant and feature
  - freeze risky write paths if integrity is in question
  - collect logs and failing request IDs
  - assess rollback threshold quickly
  - communicate status to the pilot restaurant

## Final Answer

Is this system ready for its first real restaurant client?

No. Based on the evidence collected on July 29, 2026, it is **NOT READY** because tenant isolation is still failing under test, the backend suite is not green, and finance-sensitive changes have not been re-cleared with a clean passing rerun.
