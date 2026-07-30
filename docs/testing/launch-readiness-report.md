# Launch Readiness Report

Date: Thursday, July 30, 2026

## Executive Conclusion

**NOT READY**

The software is not bug-free. The review work is complete, but unresolved launch evidence and a local test-environment data-loss incident prevent recommending the system for a real restaurant client.

## Test Evidence

### Frontend

- `npm run lint`
  - Passed with `0 errors` and `16 warnings`.
  - The remaining warnings are React hook dependency warnings and are listed as a medium risk.
- `npx tsc -b`
  - Passed.
- `npm run test:unit`
  - Passed: `23` files and `72` tests.
  - React `act(...)` warnings remain in `tests/unit/adminStaffSchedulingPage.test.tsx`.
  - Frontend coverage was not generated.
- `npm run build`
  - Passed.
  - Production warning:
    - `dist/assets/index-q9MPttlP.js`: `2,320.01 kB` minified
    - `dist/assets/three-BKLwnFPR.js`: `759.64 kB` minified
- `env PLAYWRIGHT_BASE_URL=http://127.0.0.1:4175 npm run test:e2e`
  - Browser: Chromium using Playwright's `Desktop Chrome` project.
  - Viewport: Playwright `Desktop Chrome` preset.
  - Passed: guest unlock, cart review, quantity update, idempotent order request, and progressed order state.
  - Browser console/page errors captured by the scenario: `0`.
  - Skipped: room-plan editor and public-reservation scenario.
  - Skip reason in the test: running backend APIs and seeded admin credentials are required.

The guest E2E originally failed because an active service worker served cached tenant data after PIN verification. Playwright now blocks service workers for API-mocked scenarios and the test clears browser persistence before startup.

### Backend

- `php artisan test --compact` outside the network sandbox
  - Passed: `242` tests and `2,907` assertions.
  - Backend coverage was not generated.
- `./vendor/bin/pint --test`
  - Passed: `353` files.
- PHP syntax validation across `app`, `routes`, `config`, `database`, and `tests`
  - Passed: `349` PHP files.
- `composer validate --strict --no-check-publish`
  - Passed.
- PHPStan/Psalm
  - Not configured or available; no semantic static-analysis result exists.
- `php artisan config:cache --env=production`
  - Passed.
- `php artisan route:cache --env=production`
  - Passed.
- `docker compose -f docker-compose.prod.yml config -q`
  - Passed.
- `php artisan migrate:status --env=testing`
  - Passed; all listed migrations were applied.
- `php artisan migrate:fresh --env=testing --force`
  - Passed against the explicitly isolated `restaurantdb_test`; every migration rebuilt from zero.

An intermediate `php artisan test` run found that a stale generated config cache forced `APP_ENV=local` and database `restaurantdb`. The test refresh emptied that local development database. A new PHPUnit bootstrap deletes generated config cache before Laravel test bootstrap, and the final suite was verified against `restaurantdb_test`. The local database currently has `0` users, `0` restaurants, and `0` orders.

### Mobile

Target: `../MenuScanApp`

- `npm test -- --runInBand`
  - Passed: `4` suites and `20` tests.
- `npx tsc --noEmit`
  - Passed.
- `npm run lint`
  - Failed: `11` errors and `3` warnings.
  - Includes a missing hook dependency in `src/screens/CreateDishScreen.tsx` and unused active-screen code in `src/screens/PreviewScreen.tsx`.
- Android debug build
  - Not completed.
  - The Gradle wrapper requires `gradle-9.0.0-bin.zip`; the download/build was stopped because external dependency submission/download was not explicitly authorized.
- Mobile coverage was not generated.

The mobile repository also had four pre-existing uncommitted files. This review did not modify or commit them.

### Dependency Audit

- `npm audit --omit=dev --json` for the frontend
  - Not completed; policy requires explicit approval to send dependency metadata to npm.
- `composer audit --format=json` for the backend
  - Not completed; policy requires explicit approval to send dependency metadata to Packagist.
- `npm audit --omit=dev --json` for mobile
  - Not completed; policy requires explicit approval to send dependency metadata to npm.

No vulnerability counts are reported because no audit completed.

### Performance

- `ab -n 200 -c 20 http://127.0.0.1:4175/`
  - Target: local production frontend preview, static HTML only.
  - Completed requests: `200`
  - Failed requests: `0`
  - Concurrency: `20`
  - Mean request time: `5.018 ms`
  - Longest request: `6 ms`
  - Throughput: `3,985.73 requests/second`
  - ApacheBench warned that the local timing distribution may not be reliable.
- Transactional/API load scenarios
  - Not executed.
  - `k6` and `artillery` are not installed.
  - No safe seeded staging target was provided.

The static preview benchmark is not a substitute for menu, order, inventory, reservation, queue, or database contention tests.

## Risk Summary

### Blockers

- Mobile lint fails.
- Dependency vulnerability audits are incomplete.
- The room-plan/reservation E2E remains skipped and requires a seeded backend.
- No critical transactional load test has been run.
- The local development database was emptied and requires an approved restore or reseed before it can support seeded validation.

### Critical Risks

- Test execution previously connected to the wrong local database when generated config cache existed. The code-level bootstrap guard is now in place, but local data loss occurred and restore/reseed remains unresolved.
- Broad-launch behavior under concurrent ordering, inventory deduction, reservation contention, queue processing, and kitchen updates is unmeasured.

### High Risks

- Mobile lint and Android build validation are incomplete.
- Dependency vulnerability posture is unknown.
- The main frontend bundle remains `2,320.01 kB` minified.
- Production configuration artifacts are committed and still require human secret review:
  - `Menu_React/.env.production`
  - `Menu_API/.env.production`
  - `google-services.json`
  - This review did not prove that plaintext production secrets are exposed.

### Medium Risks

- Frontend lint emits `16` hook-dependency warnings.
- Frontend unit tests emit React `act(...)` warnings.
- Browser coverage is Chromium desktop only.
- No frontend, backend, or mobile coverage report was generated.
- No PHPStan/Psalm semantic analysis is configured.

### Known Limitations

- One Playwright scenario is intentionally skipped pending a seeded backend and admin credentials.
- No mobile device or emulator runtime test was performed.
- Performance evidence covers only a local static frontend response.
- Dependency audits require explicit external-registry approval.
- The latest available SQL backups found during this review are dated June 16 and June 22, 2026; no restore was attempted.

### Manually Tested Features

None. Evidence came from automated tests, production builds, browser automation, migration commands, and source/document review.

### Untested Features

- Full room-plan and public-reservation browser flow
- Safari, Firefox, and mobile-browser guest flows
- Android install/runtime behavior
- Concurrent transactional performance and queue behavior
- Dependency vulnerability posture
- Production backup restoration

### Why Features Could Not Be Tested

- Seeded admin credentials and a safe live backend were unavailable for the skipped E2E.
- Mobile build dependencies require external download authorization.
- Dependency audits require explicit registry metadata authorization.
- No seeded staging target or load-test tool was available for transactional performance testing.

## Pilot Plan

Recommend a controlled pilot only after the blockers above are resolved and the launch review is rerun.

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
  - payroll and expense management
  - custom-domain onboarding
  - event reservations
  - room-plan write flows
  - public reservations
  - mobile scanner production use
- Errors and metrics to monitor:
  - guest unlock and order-create failures
  - idempotency replay and duplicate-order counts
  - inventory deduction mismatches
  - invoice calculation/generation failures
  - reservation conflicts
  - frontend JS errors
  - route latency and 4xx/5xx rates
  - queue, broadcast, and database deadlock failures
- Logging requirements:
  - structured request logs with tenant, route, status, latency, and correlation ID
  - guest access, order, invoice, inventory, payment, and reservation audit trails
  - queue and broadcast failure logs
  - frontend error aggregation
- Database backup plan:
  - verify a restore in staging before pilot
  - take a full backup immediately before pilot
  - take nightly full backups during pilot
  - enable point-in-time recovery where supported
- Rollback procedure:
  - disable pilot-exposed write features
  - restore the last known-good frontend and backend releases
  - stop queue workers if writes may compound corruption
  - restore the pre-pilot database snapshot if integrity is in doubt
- Support checklist:
  - named on-call owner and client contact
  - tested support login path
  - order/invoice/inventory incident runbook
  - verified backup restore instructions
- Incident-response checklist:
  - identify tenant and affected records
  - freeze affected writes when integrity is in question
  - preserve request, queue, database, and client logs
  - assess rollback/restore threshold
  - notify the pilot client with timestamps and recovery plan

## Final Answer

Is this system ready for its first real restaurant client?

**No.** Based only on the evidence collected on July 30, 2026, the system is not ready for its first real restaurant client.
