# Order Lifecycle Defects

Audit started on Sunday, July 26, 2026, with browser follow-up completed on Tuesday, July 28, 2026.

## Fixed During This Pass

1. Guest table routes returned `404` on `testing.local`.
Location: `Menu_API/app/Services/TenantRestaurantResolver.php`
Impact: `GET /api/menu/table/{table_id}` and `POST /api/menu/table/{table_id}/verify-pin` failed in tests and local browser flows because `testing.local` was treated as a non-local host, so guest restaurant fallback never executed.
Resolution: treat `testing.local` and `.local` hosts as local fallback candidates.
Status: fixed on Sunday, July 26, 2026.

2. PIN lockout state was rolled back on invalid verification attempts.
Location: `Menu_API/app/Services/TableSessionAccessService.php`
Impact: wrong PIN attempts never persisted because the counter update happened inside a transaction that threw an exception before commit. The fifth wrong attempt stayed `422` instead of locking the session, and a later correct PIN could still unlock immediately.
Resolution: persist failed-attempt updates inside the transaction and throw the HTTP response only after commit.
Status: fixed on Sunday, July 26, 2026.

3. Session-scoped guest tokens were not bound to the original device fingerprint.
Location: `Menu_API/app/Services/TableSessionAccessService.php`
Impact: a guest access token issued to one device could still be reused from another device on `/api/table-session/{tableSession}/order` and related protected session routes.
Resolution: enforce device fingerprint matching in session-scoped guest-access resolution, not only in restaurant-scoped access checks.
Status: fixed on Sunday, July 26, 2026.

4. Disabled tables were remapped to the next active table number.
Location: `Menu_API/app/Services/GuestMenuSessionService.php`
Impact: disabling `T02` still allowed `/api/menu/table/2` to load by remapping that slot to `T03`, which breaks QR stability and exposes the wrong table.
Resolution: keep stable table-number lookup over the full ordered table list and reject inactive target tables explicitly.
Status: fixed on Sunday, July 26, 2026.

5. Guest order submission had no stable browser-side idempotency key across a single in-flight submit.
Location: `Menu_React/src/pages/OrderReviewPage.tsx`
Impact: double-clicks and browser retries could produce semantically identical submit attempts without a stable client key for backend replay protection.
Resolution: keep one submit-time idempotency key for the active submission and reset it only when cart/session input changes or after success.
Status: fixed on Sunday, July 26, 2026.

## Fixed On Tuesday, July 28, 2026

1. The guest browser flow depended on a cart entry point inside an overlapping quick-actions tray.
Location: `Menu_React/src/components/Guest/GuestPageShell.tsx`, `Menu_React/src/components/Guest/GuestWaveButton.tsx`
Impact: the real Playwright browser flow reached the menu but stalled before review-page navigation because the visible `2 items in cart` quick-actions button was blocked by overlapping pointer-event interception.
Resolution: mount the standalone `GuestCartShortcut` in the shared guest shell and reserve the quick-actions tray for non-cart actions when the standard cart shortcut is available.
Status: fixed on Tuesday, July 28, 2026.

## Coverage Gaps Still Open

1. The new Playwright guest lifecycle spec currently validates the UI with mocked API routes, not a live backend stack.
Location: `Menu_React/tests/e2e/guest-order-lifecycle.spec.ts`
Impact: the browser flow now covers the critical guest journey shape and request contract, but it does not yet prove full-stack persistence, staff receipt, kitchen updates, or realtime delivery through a real service path.
Status: open as of Tuesday, July 28, 2026.

2. No browser-level kitchen dashboard coverage exists yet.
Location: `Menu_React/src/pages/ChefDashboardPage.tsx`, `Menu_React/src/pages/KitchenOrderHistoryPage.tsx`
Impact: backend kitchen API transitions are covered, but UI filtering, sorting, and realtime rendering remain unverified in-browser.
Status: open as of Tuesday, July 28, 2026.

3. Failure-path coverage for transaction rollback and partial database failure is still missing.
Location: `Menu_API/tests/Feature/OrderWorkflowTest.php`
Impact: the order lifecycle now covers price authority, idempotency, session security, waiter calls, and kitchen transitions, but it still does not inject lower-level persistence faults to prove rollback behavior.
Status: open as of Tuesday, July 28, 2026.
