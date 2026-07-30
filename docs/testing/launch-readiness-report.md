# Launch Readiness Report

Date: Thursday, July 30, 2026

## Executive Conclusion

**NOT READY**

The software is not bug-free. Based only on the evidence collected through July 30, 2026, it should not be launched to a real restaurant client yet.

## Test Evidence

### Frontend

- Command: `npm run lint`
  - Result: failed
  - Summary: `52 errors`, `17 warnings`
  - Highest-risk findings:
    - conditional hook-order violations in [`src/components/ChatBot.tsx`](/media/raed/Data/from%20ubuntu/new_menu/Menu_React/src/components/ChatBot.tsx:575)
    - synchronous state-in-effect errors in [`src/components/AppChangeGuards.tsx`](/media/raed/Data/from%20ubuntu/new_menu/Menu_React/src/components/AppChangeGuards.tsx:73), [`src/components/Common/PageScrollProgress.tsx`](/media/raed/Data/from%20ubuntu/new_menu/Menu_React/src/components/Common/PageScrollProgress.tsx:42), and [`src/components/Guest/GuestPageShell.tsx`](/media/raed/Data/from%20ubuntu/new_menu/Menu_React/src/components/Guest/GuestPageShell.tsx:47)

- Command: `npx tsc -b`
  - Result: passed

- Command: `npm run test:unit`
  - Result: passed
  - Passing: `23 files`, `72 tests`
  - Warning emitted during run:
    - React `act(...)` warnings in `tests/unit/adminStaffSchedulingPage.test.tsx`

- Command: `npm run build`
  - Result: passed
  - Production-build warning:
    - `dist/assets/index-Co199srk.js` minified size `2,319.75 kB`
    - `dist/assets/three-BKLwnFPR.js` minified size `759.64 kB`

- Commands used for browser E2E:
  - `env PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173 npm run test:e2e`
    - Sandboxed result: failed before app execution
    - Failure: Chromium sandbox crash (`sandbox_host_linux.cc:41`)
  - `env PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173 npm run test:e2e`
    - Escalated result: failed
    - Browser: Chromium
    - Project: Playwright `Desktop Chrome` preset from [`playwright.config.ts`](/media/raed/Data/from%20ubuntu/new_menu/Menu_React/playwright.config.ts:1)
    - Failing scenario:
      - `tests/e2e/guest-order-lifecycle.spec.ts`
    - Skipped scenario:
      - `tests/e2e/room-plan-reservations.spec.ts`
  - `env PLAYWRIGHT_BASE_URL=http://127.0.0.1:4174 npm run test:e2e -- --grep "Guest order lifecycle"`
    - Result after guest-menu fixes: still failed
    - Failure shape:
      - reached `Review Your Order`
      - assertion for `$37.50` failed
      - page snapshot showed stale `Alpha` cart/session state instead of the mocked `Cedar Flame` state

- Frontend coverage:
  - not available in this run

### Backend

- Command: `php artisan test`
  - Result: passed
  - Passing: `242 tests`
  - Assertions: `2907`

- Command: `php artisan test --filter='TenantDomainRoutingTest'`
  - Result: passed
  - Passing: `6 tests`
  - Assertions: `19`

- Command: `./vendor/bin/pint --test`
  - Result: failed
  - Summary: `141 style issues` across `353 files`

- Command: `php artisan config:cache`
  - Result: passed

- Command: `php artisan route:cache`
  - Result: passed

- Command: `php artisan migrate:status --env=testing`
  - Result: failed
  - Failure:
    - `SQLSTATE[HY000] [2002] Unknown error while connecting`
    - target DB: `restaurantdb_test` on `127.0.0.1:3306`

- Backend coverage:
  - not available in this run

### Mobile

- Target: `../MenuScanApp`

- Command: `npm test -- --runInBand`
  - Result: passed
  - Passing: `4 suites`, `20 tests`

- Command: `npm run lint`
  - Result: failed
  - Summary: `11 errors`, `3 warnings`
  - Highest-risk finding:
    - missing hook dependency in [`src/screens/CreateDishScreen.tsx`](/media/raed/Data/from%20ubuntu/new_menu/MenuScanApp/src/screens/CreateDishScreen.tsx:255)

- Command: `npx tsc --noEmit`
  - Result: passed

- Command: `GRADLE_USER_HOME=/tmp/menuscanapp-gradle ./gradlew :app:assembleDebug`
  - Result: failed
  - Failure:
    - Gradle wrapper attempted to download `gradle-9.0.0-bin.zip`
    - network error: `java.net.SocketException: Operation not permitted`

### Dependency Audit

- Command attempted: `composer audit --format=json`
  - Result: not completed
  - Reason:
    - policy rejection
    - explicit approval is required before sending backend dependency metadata to Packagist

- Command attempted: `npm audit --omit=dev --json` in `Menu_React`
  - Result: not completed
  - Reason:
    - policy rejection
    - explicit approval is required before sending frontend dependency metadata to the npm registry

- Command attempted: `npm audit --omit=dev --json` in `MenuScanApp`
  - Result: not completed
  - Reason:
    - policy rejection
    - explicit approval is required before sending mobile dependency metadata to the npm registry

### Performance

- Command: `which k6 || true && which artillery || true`
  - Result:
    - `k6 not found`
    - `artillery not found`

- Critical performance tests:
  - no valid performance run completed

## Risk Summary

### Blockers

- Frontend lint is red.
- Frontend browser E2E is red.
- Backend static analysis/style gate is red.
- Mobile lint is red.
- Migration validation is incomplete because the testing database is unavailable.
- Dependency audits are incomplete because explicit approval was not granted for public-registry metadata submission.

### Critical Risks

- The guest order lifecycle is not proven stable in a real browser run because the Playwright flow still fails after reaching the review page.
- Clean launch evidence for browser console behavior is missing because no browser E2E run completed successfully end-to-end.
- Migration safety is not proven because `migrate:status --env=testing` could not connect to the testing database.

### High Risks

- The frontend build emits a large-chunk warning for the main app bundle.
- Frontend lint contains hook-order and state-in-effect violations in launch-sensitive guest/admin components.
- Mobile lint contains real hook/dead-code issues in active screens.
- Production config artifacts are committed:
  - [`Menu_React/.env.production`](/media/raed/Data/from%20ubuntu/new_menu/Menu_React/.env.production:1)
  - [`Menu_API/.env.production`](/media/raed/Data/from%20ubuntu/new_menu/Menu_API/.env.production:1)
  - [`google-services.json`](/media/raed/Data/from%20ubuntu/new_menu/google-services.json:1)
  - This pass did not prove a plaintext production secret leak, but these files still require human review before launch.

### Medium Risks

- Frontend unit tests emit React `act(...)` warnings.
- Mobile Android build validation was blocked by Gradle bootstrap networking.
- Performance tooling was not available locally.
- Browser coverage is limited to Chromium and still failed before a clean pass.

### Known Limitations

- One Playwright spec is intentionally skipped because it requires seeded backend data and credentials.
- No frontend, backend, or mobile coverage report was generated.
- No dedicated clean browser-console capture was completed.
- No valid load/performance benchmark was executed.

### Manually Tested Features

- None in this pass.
- This review relied on automated checks, browser automation attempts, and source/doc review.

### Untested Features

- Full room-plan reservation browser flow
- Clean end-to-end guest order lifecycle in a real browser
- Mobile device/runtime behavior on actual hardware
- Performance and sustained-load behavior
- Audit vulnerability posture for Composer and npm dependencies

### Reason Features Could Not Be Fully Tested

- One E2E spec is explicitly skipped pending seeded backend data and admin credentials.
- The remaining guest-order E2E failure still shows stale persisted browser state during review.
- Android build validation was blocked by sandboxed network restrictions during Gradle bootstrap.
- Dependency audits require explicit approval before package metadata can be sent to public services.
- Testing DB connectivity blocked migration-status validation.

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
  - room-plan editor write flows
  - public reservations
- Errors and metrics to monitor:
  - guest unlock failures
  - order-create failures
  - idempotency replay rate
  - inventory deduction mismatches
  - invoice-generation failures
  - JS error count
  - 4xx/5xx rate by route
- Logging requirements:
  - structured request logs with tenant, route, status, and latency
  - guest access / order / invoice / inventory audit trails
  - queue and broadcast failure logs
  - frontend error aggregation for guest and admin surfaces
- Database backup plan:
  - full backup immediately before pilot enablement
  - nightly full backups during pilot
  - point-in-time recovery enabled if infrastructure supports it
- Rollback procedure:
  - disable pilot-exposed features
  - restore the last known-good frontend build
  - restore the last known-good backend release
  - restore database from the pre-pilot snapshot if integrity is in doubt
- Support checklist:
  - named on-call owner
  - tested support login path
  - runbook for order/invoice/inventory incidents
  - backup restore instructions validated in advance
- Incident-response checklist:
  - identify tenant scope
  - freeze affected writes if integrity is in question
  - collect request, queue, and client logs
  - assess rollback threshold
  - notify pilot client with timestamps and recovery plan

## Final Answer

Is this system ready for its first real restaurant client?

**No.** Based on the evidence collected through July 30, 2026, the system is not ready for its first real restaurant client.
