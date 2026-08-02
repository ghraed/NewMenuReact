# Launch Readiness Report

Review date: 2026-08-02

## Executive conclusion

**NOT READY**

The collected evidence shows that the core automated backend, frontend, mobile, and isolated Chromium E2E suites are green. The system is not being described as bug-free. It must not launch for a real restaurant until the exposed SSH credential is rotated and historical exposure is remediated, the two high frontend dependency advisories are resolved or formally accepted with compensating controls, and Android production signing is configured and verified.

## Test evidence

Only observed results are listed below.

| Area | Command / scenario | Result |
| --- | --- | --- |
| Backend tests | `php artisan test --compact` | 246 passed, 2,915 assertions, 48.87 s |
| Backend security | `php artisan test tests/Feature/AuthSecurityTest.php --compact` | 10 passed, 23 assertions |
| Backend formatting | `./vendor/bin/pint --test` | Passed, 356 files |
| Backend syntax | `php -l` on modified security, migration, and factory files | Passed |
| Backend production validation | `php artisan config:cache --env=production`; `php artisan route:cache --env=production` | Both passed |
| Migration validation | `env APP_ENV=testing php artisan migrate:fresh --seed --force` | Passed; new `add_is_active_to_users_table` migration applied |
| Migration no-op | `env APP_ENV=testing php artisan migrate --pretend` | `Nothing to migrate.` |
| Backend audit | `composer audit` | No advisories |
| Frontend lint | `npm run lint` | Passed |
| Frontend type/build | `npm run build` | Passed; production warning recorded below |
| Frontend unit tests | `npm run test:unit` | 23 files passed, 72 tests passed |
| Frontend E2E | `npx playwright test --reporter=list` | 2 passed, 6.2 s |
| E2E scenarios | Guest table unlock/cart/submit/status; room-plan create/save/public reservation availability | Passed |
| E2E browser / viewport | Playwright `chromium`, `Desktop Chrome` device preset; one worker; no retries | Passed |
| Browser console | Guest lifecycle assertion completed without browser-console errors; room-plan flow passed | No observed console error in passing flows |
| Frontend audit | `npm audit` | 2 high findings: `react-router`, `react-router-dom` |
| Static frontend performance | `ab -n 200 -c 20 http://127.0.0.1:4175/` | 200 complete, 0 failed, 3,233.11 req/s mean, 6.186 ms mean request time |
| Mobile lint | `npm run lint` | Passed |
| Mobile type check | `npx tsc --noEmit` | Passed |
| Mobile tests | `npm test -- --runInBand` | 4 suites passed, 20 tests passed |
| Mobile release build | `./gradlew assembleRelease --no-daemon` | Passed |
| Mobile signing validation | `./gradlew verifyReleaseSigning --no-daemon` | Failed intentionally: production signing is not configured |
| Mobile audit | `npm audit` | 0 vulnerabilities |

Coverage: no backend or frontend coverage report was available from the configured commands. No coverage percentage is claimed.

Skipped tests: the backend has conditional skip branches for unavailable OpenSSL and invoice-PDF tooling. `openssl`, `google-chrome`, and `pdftotext` were present; the successful backend suite showed no observed conditional skip result. No frontend or mobile source-level test skips were found.

Static analysis: Pint and PHP syntax passed. No PHPStan or Psalm configuration was found.

## Risk summary

### Blockers

- Private SSH key material was tracked in the mobile repository. Current files were removed and ignored, but credential rotation and remote/history remediation have not been evidenced.
- `npm audit` still reports two high React Router advisories. The Vite SPA does not have a reviewed RSC/SSR entry point, but there is no safe patched npm release in the current audit result.
- Android release signing is unconfigured. The guard correctly blocks signed release validation.

### Critical risks

- No unresolved automated finding demonstrated cross-tenant leakage, unauthorized protected access, incorrect invoice arithmetic, duplicate ordinary-retry orders, double inventory deduction, reservation double booking, or a broken order lifecycle. Backend tests covering tenant and critical workflow behavior passed, but this is not a guarantee against undiscovered defects.
- An exposed credential remains launch-critical until rotation and history remediation are complete.

### High risks

- The production frontend main chunk is 2,319.74 kB minified and triggered Vite's 1,200 kB warning threshold.
- The unresolved high dependency advisories require an upstream remediation decision.
- Mobile cannot be released until a production signing key is securely configured and the guard passes.

### Medium risks and limitations

- The ApacheBench result measures only static local serving, not critical transactional throughput or database contention.
- Firefox, WebKit, mobile browser viewports, physical devices, payment integrations, realtime/push, and full staff/kitchen browser journeys were not executed.
- No coverage report or semantic PHP static-analysis tool is configured.

### Manually tested features

- Local isolated test login was verified against `restaurantdb_test` after reseeding.
- Production frontend static preview was requested locally for the ApacheBench check.

### Untested features and reason

- Production services were intentionally not used; all live E2E traffic was directed to local isolated test servers.
- Device and browser matrix testing requires physical hardware or additional browser projects not configured in this workspace.
- Transactional load, queue, and lock-contention performance requires a controlled load environment and observability stack not available in this run.

## Controlled pilot plan

Begin this plan only after every blocker above is closed and the same checks are rerun.

- Suggested duration: 2 weeks.
- Pilot restaurants: 1 restaurant.
- Enable initially: public menu, authenticated admin/staff workflows, QR menu, and the individually rehearsed ordering/reservation paths.
- Disable initially: mobile distribution, custom domains, AI features, push/realtime notifications, invoice splitting, and any payment integration not separately validated in the pilot environment.
- Monitor: API 4xx/5xx rate, authentication failures, order idempotency replays, duplicate order count, inventory movement balance, reservation conflicts, invoice/tax deltas, queue depth, broadcast failures, frontend load time, and browser errors.
- Logging: structured request IDs, restaurant ID, authenticated user ID, order/session/reservation ID, idempotency key, payment/invoice reference, audit events, and error stack traces. Do not log credentials or tokens.
- Backups: verified pre-pilot database backup, daily encrypted backups, point-in-time recovery verification, and a restore drill before enabling client data.
- Rollback: freeze new orders if data integrity is in doubt, put affected restaurant features in maintenance mode, restore from the verified backup only under an incident lead, then reconcile orders/inventory/invoices before reopening.
- Support checklist: named owner, business-hours contact channel, restaurant onboarding checklist, known-issue disclosure, browser/device support list, and order/invoice reconciliation procedure.
- Incident response: assign incident lead, preserve logs and request IDs, disable the affected feature flag, assess tenant scope and data integrity, notify the restaurant when required, reconcile data, document root cause, and rerun the affected regression tests before re-enabling.

## Answer

Is this system ready for its first real restaurant client? **No.** The core automated evidence is strong, but unresolved credential exposure, high dependency advisories, and missing Android production signing prevent an honest launch recommendation.
