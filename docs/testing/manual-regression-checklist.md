# Manual Regression Checklist

Date: Wednesday, July 29, 2026

Scope covered from this workspace:
- `Menu_React` web frontend
- `MenuScanApp` React Native Jest baseline
- backend security and tenancy review inputs from `Menu_API`

## Executed Automated Baseline

Executed on Wednesday, July 29, 2026:
- `npm run test:unit`
- `npm run test`
- `npm run dev -- --host 127.0.0.1`
- `npm run test:e2e`
- `npm run test:e2e` outside the sandbox after the initial Chromium launch failure

Observed results:
- `MenuScanApp`: Jest passed, 4 suites, 20 tests, 0 failures.
- `Menu_React`: Vitest improved after test-harness repairs, and one real failing test remains:
  - passing after repair: 22 files / 71 tests
  - failing: `tests/unit/adminPayrollManagementPage.test.tsx`
  - current failure indicates the page submits a negative-net payroll payload instead of blocking it
- `Playwright`:
  - initial sandboxed run failed before app execution with `sandbox_host_linux.cc:41` and `shutdown: Operation not permitted (1)`
  - rerun outside the sandbox passed `tests/e2e/guest-order-lifecycle.spec.ts`
  - `tests/e2e/room-plan-reservations.spec.ts` remains intentionally skipped because it requires seeded backend data and credentials

## Browser E2E Status

Critical browser journeys requested:
1. Admin creates or configures a restaurant
2. Owner logs in
3. Owner creates categories and dishes
4. Owner configures rooms and tables
5. Guest opens a table QR URL
6. Guest browses the menu
7. Guest searches and filters
8. Guest places an order
9. Staff confirms it
10. Chef processes it
11. Guest requests invoice
12. Invoice is generated
13. Guest splits invoice
14. PDF is viewed or downloaded
15. Inventory is deducted once
16. Finance dashboard reflects the transaction
17. Restricted feature is blocked
18. Restaurant A cannot access Restaurant B

Status on Wednesday, July 29, 2026:
- Executable only outside the sandbox for the existing mocked Chromium flow.
- Existing Playwright coverage in repo is limited to:
  - `tests/e2e/guest-order-lifecycle.spec.ts`: mocked guest ordering lifecycle
  - `tests/e2e/room-plan-reservations.spec.ts`: backend-seeded admin/reservation flow, currently skipped by design

Implication:
- Desktop/mobile, English/Arabic, and Firefox/WebKit critical browser journeys remain unverified in runtime on July 29, 2026.
- They should be rerun in a browser-capable CI or staging runner before release.

## Frontend Resilience Status

Verified by existing unit coverage on Wednesday, July 29, 2026:
- public menu routing, LTR/RTL switching, and filter interaction
- reservation availability blocking and selection
- room plan persistence and reopen behavior
- guest dish rendering
- finance dashboard and expense form validation
- cashier POS out-of-stock filtering
- staff scheduling create/status flows

Partially verified only through source review or mocks:
- loading states
- empty states
- validation messages
- route guards
- feature gating

Not runtime-verified in browser on Wednesday, July 29, 2026:
- slow network behavior
- timeout handling
- duplicate-click protection in real browser
- expired authentication refresh behavior
- refresh on protected route
- deep-link recovery
- broken image rendering
- long Arabic text under mobile layout
- console-error and unhandled-rejection clean runs in browser

## React Native Status

Executed:
- `cd /media/raed/Data/from ubuntu/new_menu/MenuScanApp && npm run test`

Observed:
- 4 passing suites, 20 passing tests, 0 failures

What this does and does not prove:
- proves the current RN Jest baseline is green
- does not prove device/runtime scenarios such as notifications, offline, background/foreground, Android back button, or RTL layout on device

Device-only scenarios to run separately:
- login against a real test backend
- role navigation
- new-order visibility
- kitchen updates
- waiter updates
- push notification receipt/tap
- offline and reconnection
- background to foreground refresh
- repeated taps on high-latency actions
- expired token recovery
- Arabic RTL
- Android back button

## Release Blocking Gaps

Treat these as release blockers for the requested matrix:
- Full browser E2E matrix is still incomplete even though the existing mocked Chromium flow now runs outside the sandbox.
- No safe staging or local test backend was available to validate the full cross-role order to invoice lifecycle.
- Performance scenarios were not run because neither `k6` nor `artillery` is installed here and no safe staging target was available.
- One real payroll validation failure remains in `tests/unit/adminPayrollManagementPage.test.tsx`.

## Recommended Next Run

Run in a browser-capable CI or staging host with seeded backend data:
- `npm run test:e2e`
- add Playwright projects for desktop/mobile and Arabic/English
- rerun critical flows in Chromium first, then Firefox/WebKit if stable
- fix the payroll negative-net validation regression and rerun the unit suite
