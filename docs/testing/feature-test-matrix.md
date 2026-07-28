# Feature Test Matrix

Scope: audit of `Menu_React` and sibling backend `Menu_API` completed on July 24, 2026. The inspected workspace contains a React/Vite web application and a Laravel API. No React Native application or mobile screens were found in these repositories.

Current execution snapshot:
- Backend: `php artisan test` ran and finished with 83 passing tests and 60 failing tests.
- Frontend: `npm run test:unit` ran and finished with 15 passing files, 3 failing files, 55 passing tests, and 6 failing tests.
- E2E: one Playwright spec exists and is permanently skipped pending a real environment.

## July 26, 2026 Targeted Update
- Date of targeted pass: Sunday, July 26, 2026.
- Backend targeted coverage added and executed successfully: `RestaurantConfigurationApiTest`, `DishManagementApiTest`, `PublicMenuApiTest`, plus new slug/category assertions in `SuperAdminCustomDomainProvisioningTest`.
- Backend targeted result on July 26, 2026: 21 passing tests, 139 assertions, 0 failures.
- Frontend component and route-level integration coverage added and executed successfully: `tests/unit/guestDishCard.test.tsx` and `tests/unit/publicMenuRoutes.test.tsx`.
- Frontend targeted unit result on July 26, 2026: 2 passing files, 5 passing tests, 0 failures.
- Public-menu automated coverage now validates search, category filters, language switching, RTL/LTR direction, direct dish URLs, empty-menu handling, and no `console.error` emissions during those route flows.
- A true browser-console and `pageerror` pass with Playwright remains blocked in this sandbox because Chrome exits before a stable Playwright-managed session can be established.

## July 26, 2026 Order Lifecycle Update
- Date of lifecycle pass: Sunday, July 26, 2026.
- Backend lifecycle coverage added or extended in `TableSessionSecurityTest`, `OrderWorkflowTest`, `WaveWorkflowTest`, `KitchenWorkflowTest`, and `TenantRestaurantResolverCustomDomainTest`.
- Backend lifecycle result on July 26, 2026: 51 passing tests, 395 assertions, 0 failures.
- New browser coverage was added in `tests/e2e/guest-order-lifecycle.spec.ts` for the critical guest flow: table unlock, cart review, note entry, order submit, idempotency header assertion, and progressed order-state rendering.
- The new Playwright flow currently uses API route mocks, so it validates the browser UX and request contract but not a live backend/service path yet.
- Browser execution was run on Sunday, July 26, 2026 after installing Playwright Chromium, and it failed in the guest menu UI before review-page navigation because the floating quick-actions cart button was not clickable under real browser pointer-event checks.

## July 28, 2026 Browser Follow-Up
- Date of browser follow-up: Tuesday, July 28, 2026.
- Guest UI changes completed in `GuestPageShell.tsx` and `GuestWaveButton.tsx` so cart navigation no longer depends on the overlapping quick-actions cart button when a standard cart shortcut is available.
- The Playwright critical-order-flow spec was aligned with the real rendered UI and executed successfully on Tuesday, July 28, 2026.
- Browser result on July 28, 2026: `tests/e2e/guest-order-lifecycle.spec.ts` passed in Chromium in 3.6 seconds.

### Defects Found On July 26, 2026
- Reserved restaurant slugs are not validated in `Menu_API/app/Http/Controllers/SuperAdmin/SuperAdminRestaurantManagementController.php`; duplicate slugs are rejected, but reserved names still have no enforcement path.
- The requested menu-category management surface does not exist as a first-class feature. Categories are stored only as a restaurant `profile.menu_categories` array, so there is no dedicated CRUD/order/hide API or UI that matches the requested category matrix.
- The public menu currently exposes ingredient filtering, not explicit allergy filtering. The requested allergy-filter behavior is not implemented as a distinct UI or backend contract.
- Authenticated profile routes are not role-gated in `routes/api.php`, but `RestaurantController::getOwnedRestaurant()` only resolves the owned restaurant. In practice, non-owner authenticated roles can hit the route and receive a 403 instead of being blocked consistently by role middleware.
- Order-lifecycle defects and fixes from Sunday, July 26, 2026 are recorded in `docs/testing/order-lifecycle-defects.md`.

### Remaining Manual Checks
- Run a real browser pass for the public menu in a non-sandboxed environment and inspect the browser console/network panel during the flow; current automated coverage checks route behavior and `console.error`, but not a full Playwright browser session.
- Validate restaurant logo upload manually in the browser with real PNG, JPG, WEBP, invalid, and oversized files to confirm frontend previews and storage URLs beyond API validation.
- Verify host-based tenant separation in a real browser across custom domains or local subdomains; the new automated E2E uses mocked same-origin API responses and does not cover DNS/host routing.
- Confirm expected product rules for reserved slugs, category CRUD/order/hide behavior, and allergy filters before writing enforcement tests for those cases.

## 1. Tenant Auth, Roles, Feature Flags, Super Admin
- Feature name: tenant auth, role access, feature-flag control, super-admin restaurant lifecycle.
- Relevant files: `Menu_API/routes/api.php`, `Menu_API/app/Models/User.php`, `Menu_API/app/Http/Middleware/EnsureUserHasRole.php`, `Menu_API/app/Http/Middleware/EnsureSaasOwner.php`, `Menu_API/app/Http/Middleware/RestrictChefApiSurface.php`, `Menu_API/app/Services/FeatureFlagService.php`, `Menu_API/app/Services/TenantRestaurantResolver.php`, `Menu_API/app/Http/Controllers/AuthController.php`, `Menu_API/app/Http/Controllers/SuperAdmin/SuperAdminAuthController.php`, `Menu_API/app/Http/Controllers/SuperAdmin/SuperAdminFeatureFlagController.php`, `Menu_API/app/Http/Controllers/SuperAdmin/SuperAdminRestaurantManagementController.php`, `Menu_React/src/contexts/AuthContext.tsx`, `Menu_React/src/contexts/SuperAdminAuthContext.tsx`, `Menu_React/src/components/Auth/ProtectedRoute.tsx`, `Menu_React/src/utils/auth.ts`, `Menu_React/src/utils/features.ts`.
- Roles involved: `saas_owner`, `admin`, `restaurant_admin` alias, `staff`, `chef`, `stock_manager`, `accountant`.
- Happy path: admin logs in, receives tenant-scoped user payload and feature flags, reaches only allowed routes; super admin creates restaurants, toggles flags, provisions domains.
- Failure scenarios: invalid login; disabled feature returns 404; unknown domain/slug; restricted roles hit disallowed endpoints; invalid custom domain; duplicate domain; broken current-restaurant resolution.
- Permission scenarios: super admin only for restaurant setup and feature management; backend role middleware plus `RestrictChefApiSurface`; frontend `ProtectedRoute` and feature gating.
- Tenant-isolation requirements: every authenticated request must resolve the correct restaurant; feature flags must be read and written only for the active tenant; cross-tenant staff membership must not fall back to the wrong restaurant.
- Edge cases: legacy roles `add`, `stock_manger`, `accoutant`; `restaurant_admin` normalization; users attached to more than one restaurant; local-host fallback; owner and super-admin alias routes.
- Current coverage: `SuperAdminCustomDomainProvisioningTest`, `TenantDomainRoutingTest`, `TenantRestaurantResolverCustomDomainTest`, `DomainNameTest`, `StaffManagementTest` partially cover auth, tenant routing, and super-admin flows.
- Missing coverage: multi-restaurant user selection; feature flag audit-log verification; restricted-role route matrix; frontend route gating; hardcoded feature bypass behavior in `src/utils/features.ts`.
- Risk level: critical.

## 2. Public Guest Menu, Dishes, QR Entry
- Feature name: public guest menu browsing by slug, host, and table context.
- Relevant files: `Menu_API/app/Http/Controllers/GuestController.php`, `Menu_API/app/Http/Controllers/MenuController.php`, `Menu_API/app/Http/Controllers/GuestTableAccessController.php`, `Menu_API/app/Services/GuestMenuSessionService.php`, `Menu_API/app/Services/TenantRestaurantResolver.php`, `Menu_API/routes/api.php`, `Menu_React/src/pages/GuestDishListPage.tsx`, `Menu_React/src/pages/GuestDishPage.tsx`, `Menu_React/src/pages/GuestDishIngredientsPage.tsx`, `Menu_React/src/contexts/GuestMenuResourceContext.tsx`, `Menu_React/src/services/api.ts`, `Menu_React/src/services/orderService.ts`.
- Roles involved: guest, tenant admin for publishing content.
- Happy path: guest lands on `/menu`, `/menu/:restaurant_slug`, or `/menu/table/:table_id`, sees only published/orderable menu content and dish details.
- Failure scenarios: unknown host; inactive table; unpublished dish; disabled `qr_menu`; broken host-to-restaurant mapping.
- Permission scenarios: public reads only; staff/admin publish through dish endpoints; guest table context only reveals the matching tenant.
- Tenant-isolation requirements: host and slug resolution must never leak another restaurant’s dishes or table metadata.
- Edge cases: local-host fallback, custom-domain `www` variants, inactive tables, empty published catalog.
- Current coverage: `TenantDomainRoutingTest`, `SharedProductFlowTest`, `GuestTableVisibilityTest`, `MenuItemApiTest`.
- Current coverage includes July 26, 2026 additions: `PublicMenuApiTest` and `tests/unit/publicMenuRoutes.test.tsx`.
- Missing coverage: real-browser public-menu execution with console/network inspection, guest host-switching in the frontend, QR code scan entry, and explicit allergy filtering because that feature is not implemented.
- Risk level: critical.

## 3. Guest Table Access, PIN Verification, Session Security
- Feature name: table-session activation, PIN verification, guest authorization, session heartbeat.
- Relevant files: `Menu_API/app/Http/Controllers/TableSessionController.php`, `Menu_API/app/Http/Middleware/EnsureGuestTableAccess.php`, `Menu_API/app/Services/TableSessionAccessService.php`, `Menu_API/app/Services/GuestMenuSessionService.php`, `Menu_API/app/Models/TableSession.php`, `Menu_API/app/Models/TableGuestAccess.php`, `Menu_API/app/Models/RestaurantTable.php`, `Menu_API/routes/api.php`, `Menu_React/src/utils/guestAccess.ts`, `Menu_React/src/utils/guestTableRoutes.ts`, `Menu_React/src/components/Guest/GuestTableAccessPanel.tsx`.
- Roles involved: guest, staff, admin.
- Happy path: staff activates a session, guest verifies PIN, receives scoped access token/cookie state, can heartbeat and place session-bound actions.
- Failure scenarios: wrong PIN; lockout; expired session; reset PIN; finalized session; guest without access hits protected endpoint.
- Permission scenarios: only authorized guest session can use session endpoints; staff/admin can activate/reset/finalize.
- Tenant-isolation requirements: guest access must be tied to one table session in one restaurant only; old session pins must not unlock new sessions.
- Edge cases: repeated verification attempts, multiple simultaneous guests, revisiting same table, finalized or suspended sessions.
- Current coverage: `TableSessionSecurityTest` exists and targets the right cases.
- Current coverage includes the Sunday, July 26, 2026 pass result: 18 passing tests covering valid QR access, wrong PIN lockout, expired/finalized session denial, cross-restaurant/table token rejection, duplicate session reuse, session reset, waiter call, and request-bill flows.
- Missing coverage: no frontend component tests for `GuestTableAccessPanel`; no live-browser E2E against a real backend/session store; concurrent session creation still relies on API-level rather than load-level verification.
- Risk level: critical.

## 4. Guest Ordering, Waiter Call, Request Bill, Split Draft
- Feature name: guest table ordering, waiter-wave creation, bill requests, guest invoice split updates.
- Relevant files: `Menu_API/app/Http/Controllers/OrderController.php`, `Menu_API/app/Http/Controllers/WaveController.php`, `Menu_API/app/Http/Controllers/TableSessionController.php`, `Menu_API/app/Services/InvoiceSplitService.php`, `Menu_API/app/Events/TableWaveCreated.php`, `Menu_API/app/Events/TableWaveResolved.php`, `Menu_API/app/Models/Order.php`, `Menu_API/app/Models/TableWave.php`, `Menu_API/routes/api.php`, `Menu_React/src/pages/OrderReviewPage.tsx`, `Menu_React/src/pages/GuestOrdersPage.tsx`, `Menu_React/src/pages/GuestInvoicePage.tsx`, `Menu_React/src/services/orderService.ts`, `Menu_React/src/utils/guestOrderCompensation.ts`, `Menu_React/src/utils/guestInvoicePayload.ts`.
- Roles involved: guest, staff, admin.
- Happy path: guest with verified session places order, staff sees pending work, guest calls waiter or requests bill, split mode can be edited when enabled.
- Failure scenarios: no guest authorization; disabled `table_ordering`, `waiter_call`, `request_bill`, or `invoice_splitting`; out-of-stock dish; duplicate pending wave; invalid split allocation.
- Permission scenarios: guests only on authorized sessions; staff confirm/cancel/serve; only finance roles finalize invoice.
- Tenant-isolation requirements: all orders, waves, and split drafts stay inside the session’s restaurant and table.
- Edge cases: equal split remainder handling, by-person order allocation, reminder waves, legacy orders with null dish IDs, bill requests with partial guest departures.
- Current coverage: `OrderWorkflowTest`, `WaveWorkflowTest`, `TableSessionSecurityTest`, `OrderInventoryDeductionTest`, frontend compensation math tests.
- Current coverage includes the Sunday, July 26, 2026 pass result: 27 passing workflow tests across `OrderWorkflowTest` and `WaveWorkflowTest`, plus the new browser spec `tests/e2e/guest-order-lifecycle.spec.ts`.
- Current coverage also includes the Tuesday, July 28, 2026 browser result: the critical guest flow now passes in Playwright from unlock through review, submit, and post-submit order-status view.
- Missing coverage: no live end-to-end path from guest submit to backend persistence and staff/kitchen consumption; rollback and partial-database-failure cases are still not directly simulated; guest-side double-submit coverage is limited to idempotency-key contract checks and mocked browser flow.
- Risk level: critical.

## 5. Staff Pending Orders, Table Operations, Waiter Dashboard
- Feature name: waiter/staff dashboard for pending orders, table sessions, quick edits, and service waves.
- Relevant files: `Menu_API/app/Http/Controllers/OrderController.php`, `Menu_API/app/Http/Controllers/TableSessionController.php`, `Menu_API/app/Http/Controllers/WaveController.php`, `Menu_API/app/Services/StaffCapabilityService.php`, `Menu_API/routes/channels.php`, `Menu_React/src/pages/StaffOrdersPage.tsx`, `Menu_React/src/pages/TodayOrdersPage.tsx`, `Menu_React/src/pages/TodayOrderDetailsPage.tsx`, `Menu_React/src/components/Staff/StaffOrderEditor.tsx`, `Menu_React/src/services/orderService.ts`, `Menu_React/src/services/pushNotifications.ts`, `Menu_React/src/services/offlineQueue.ts`, `Menu_React/src/services/offlineStore.ts`.
- Roles involved: `staff`, `admin`.
- Happy path: assigned waiter sees only their tables, confirms or edits pending orders, resolves waves, resets/finalizes sessions, and receives realtime or push updates.
- Failure scenarios: waiter not assigned to table; offline queue desync; stale realtime state; push registration failure; staff tries to access another waiter’s table.
- Permission scenarios: `StaffCapabilityService` enforces table assignment; admin sees all tables; staff must not reach accounting or dish admin surfaces.
- Tenant-isolation requirements: table assignment and wave subscriptions must stay within the waiter’s current restaurant and assigned tables.
- Edge cases: admin mode with all tables, browser notification permissions, offline waiter action replay, mobile polling fallback.
- Current coverage: `OrderWorkflowTest`, `WaveWorkflowTest`, `StaffManagementTest`; no direct frontend tests for `StaffOrdersPage`.
- Missing coverage: frontend state synchronization, offline queue recovery, push subscription behavior, realtime reconnection, waiter assignment regression matrix.
- Risk level: high.

## 6. Kitchen Workflow
- Feature name: kitchen queue, start/ready/served transitions, kitchen history.
- Relevant files: `Menu_API/app/Http/Controllers/OrderController.php`, `Menu_API/app/Events/KitchenOrderCreated.php`, `Menu_API/app/Events/KitchenOrderUpdated.php`, `Menu_API/app/Events/KitchenOrderReady.php`, `Menu_API/routes/channels.php`, `Menu_React/src/pages/ChefDashboardPage.tsx`, `Menu_React/src/pages/KitchenOrderHistoryPage.tsx`, `Menu_React/src/services/orderService.ts`.
- Roles involved: `chef`, `admin`.
- Happy path: confirmed orders enter kitchen queue, chef starts prep, marks ready, staff sees ready state, served state is recorded.
- Failure scenarios: chef accesses wrong tenant, invalid state reversal, realtime failure, stale kitchen queue, dish without kitchen fields.
- Permission scenarios: kitchen routes allowed only for chef/admin; `RestrictChefApiSurface` must not leak other endpoints.
- Tenant-isolation requirements: kitchen channel and queries scoped by restaurant.
- Edge cases: undo start/ready, mixed prepared and packaged items, kitchen history filters.
- Current coverage includes the Sunday, July 26, 2026 addition of `KitchenWorkflowTest` with 3 passing tests for queue scoping, valid transitions, ready-to-served handoff, filtering, and cross-tenant rejection.
- Missing coverage: frontend kitchen dashboard/history rendering; duplicate-event and queue-retry simulation at the transport layer; browser-level verification of kitchen realtime updates.
- Risk level: high.

## 7. Accounting Queue, Invoice Finalization, POS Checkout
- Feature name: accounting order queue, invoice preview/finalization, POS quick checkout, cashier UI.
- Relevant files: `Menu_API/app/Http/Controllers/OrderController.php`, `Menu_API/app/Http/Controllers/InvoiceController.php`, `Menu_API/app/Services/OrderInvoiceCalculator.php`, `Menu_API/app/Domain/Finance/FinanceCalculator.php`, `Menu_API/app/Services/InvoiceSplitService.php`, `Menu_API/routes/channels.php`, `Menu_React/src/pages/AccountingOrdersPage.tsx`, `Menu_React/src/pages/AdminFinanceInvoiceDetailsPage.tsx`, `Menu_React/src/pages/CashierPosPage.tsx`, `Menu_React/src/pages/InvoicePrintPage.tsx`, `Menu_React/src/components/Invoice/InvoiceTemplate.tsx`, `Menu_React/src/utils/financeMath.ts`, `Menu_React/src/utils/invoicePreviewCompensation.ts`, `Menu_React/src/services/orderService.ts`, `Menu_React/src/services/invoiceService.ts`.
- Roles involved: `admin`, `accountant`; backend `pos/checkout` route also admits `staff`, `chef`, `stock_manager`.
- Happy path: staff confirms order, accounting queue receives it, operator applies tax/discount/compensation, creates invoice, optionally auto-creates linked expense entries, and prints invoice; POS handles walk-in/pickup/delivery.
- Failure scenarios: wrong payment received amount; invalid tax or discount; split/session inconsistency; duplicate accounting events; compensation metadata mismatch; non-finance role access.
- Permission scenarios: accounting endpoints require admin/accountant; frontend POS route is admin-only despite broader backend route.
- Tenant-isolation requirements: invoice totals, linked orders, expense side effects, and realtime accounting events stay within one restaurant.
- Edge cases: complimentary items, partial discounts, operational loss buckets, draft vs paid invoice mode, selected table save-before-finalize flow.
- Current coverage: `FinanceParityTest`, `CurrencySettingsControllerTest`, `OrderWorkflowTest`, frontend `financeMath`, `financeReporting`, `invoicePreviewCompensation`, `cashierPosPage` tests.
- Missing coverage: current frontend POS and payroll UI tests are broken; no E2E accounting flow; no explicit test for accounting broadcast-channel authorization; role mismatch around cashier behavior.
- Risk level: critical.

## 8. Restaurant Profile, Currency, QR Codes, Staff Management, Table Management
- Feature name: restaurant back-office setup, staff creation, table assignments, QR generation, currency settings.
- Relevant files: `Menu_API/app/Http/Controllers/RestaurantController.php`, `Menu_API/app/Http/Controllers/CurrencySettingsController.php`, `Menu_API/app/Http/Controllers/QRCodeController.php`, `Menu_API/app/Services/TableManagementModeService.php`, `Menu_API/app/Services/TableProvisioningService.php`, `Menu_API/routes/api.php`, `Menu_React/src/pages/AdminRestaurantProfilePage.tsx`, `Menu_React/src/pages/AdminUserProfilePage.tsx`, `Menu_React/src/pages/AdminCurrencyPage.tsx`, `Menu_React/src/pages/AdminStaffPage.tsx`, `Menu_React/src/services/staffService.ts`, `Menu_React/src/services/tableManagementService.ts`, `Menu_React/src/services/restaurantProfileService.ts`.
- Roles involved: `admin`, `accountant` for profile/currency; `admin` for staff UI.
- Happy path: admin updates branding/currency/profile, creates staff accounts, assigns waiter tables, sets manual table count, downloads dish/table QR codes.
- Failure scenarios: missing manual table count before assignments; invalid role; duplicate staff identity; table provisioning mismatch; currency validation failure.
- Permission scenarios: admin-only for staff creation; admin/accountant for profile and currency.
- Tenant-isolation requirements: staff list and table assignments limited to one restaurant; QR code output must target that tenant.
- Edge cases: phone-only staff accounts, restoring/changing manual table mode, mixed waiter/chef assignments.
- Current coverage: `StaffManagementTest`, `CurrencySettingsControllerTest`, `OrderWorkflowTest` partial.
- Current coverage includes July 26, 2026 additions: `RestaurantConfigurationApiTest` for profile update, legal/contact/tax fields, currency/exchange-rate validation, logo upload, missing-context handling, and tenant isolation.
- Missing coverage: QR code output validation, table-management mode switching, browser-level restaurant settings UI flows, and any product-level tax setting beyond registration fields.
- Risk level: high.

## 9. Dish and Menu Item Management, Assets, AR/3D, AI Description
- Feature name: dish CRUD, menu-item templates, asset upload, preview/model copy, AR and ingredient storytelling data.
- Relevant files: `Menu_API/app/Http/Controllers/DishController.php`, `Menu_API/app/Http/Controllers/AssetController.php`, `Menu_API/app/Http/Controllers/AssetFileController.php`, `Menu_API/app/Services/DishDescriptionGenerationService.php`, `Menu_API/app/Services/DishAlternativeSuggestionService.php`, `Menu_API/app/Models/Dish.php`, `Menu_API/app/Models/DishAsset.php`, `Menu_API/routes/api.php`, `Menu_React/src/pages/CreateDishPage.tsx`, `Menu_React/src/pages/EditDishPage.tsx`, `Menu_React/src/pages/AdminDishPage.tsx`, `Menu_React/src/components/Admin/DishForm.tsx`, `Menu_React/src/components/Admin/ProductItemForm.tsx`, `Menu_React/src/components/AR/ARButton.tsx`, `Menu_React/src/components/Guest/DishViewer.tsx`, `Menu_React/src/services/dishDescriptionService.ts`.
- Roles involved: `admin`, `chef`, `stock_manager`.
- Happy path: authorized staff creates dish/menu item, uploads preview/model assets, generates description, publishes item, guest sees only published content.
- Failure scenarios: invalid item type; packaged items with recipe ingredients; copying from non-ready model; asset file not reachable; AI generation failure.
- Permission scenarios: restricted to admin/chef/stock_manager; guests only read published outputs.
- Tenant-isolation requirements: dish CRUD, asset files, suggestions, and related-dish links must stay within one restaurant.
- Edge cases: deleted dish restore/force delete, dish currency overrides, alternative dishes, direct-stock packaged items, missing AR assets.
- Current coverage: `MenuItemApiTest`, `CopyDishModelTest`, `AssetFileControllerTest`, `PreviewImageAssetUploadTest`, `SharedProductFlowTest`, `IngredientImageAssetTest`.
- Current coverage includes July 26, 2026 additions: `DishManagementApiTest` for multilingual create/update/delete, zero and large price handling, negative-price rejection, category ownership, cross-tenant ingredient validation, and suggested/related dish scoping.
- Missing coverage: dedicated category CRUD/order/hide tests because that feature is not implemented, frontend dish-create/edit pages, AR rendering fallbacks, AI description failures, and browser-driven image-upload flows.
- Risk level: high.

## 10. Ingredient Library and Global Catalog
- Feature name: tenant ingredient library, image generation, global ingredient lookup.
- Relevant files: `Menu_API/app/Http/Controllers/IngredientLibraryController.php`, `Menu_API/app/Http/Controllers/GlobalIngredientController.php`, `Menu_API/app/Services/GlobalIngredientProvisioningService.php`, `Menu_API/app/Models/Ingredient.php`, `Menu_API/app/Models/GlobalIngredient.php`, `Menu_API/routes/api.php`, `Menu_React/src/pages/IngredientLibraryPage.tsx`, `Menu_React/src/pages/IngredientLibrary.tsx`, `Menu_React/src/pages/GlobalIngredientsPage.tsx`, `Menu_React/src/services/ingredientLibraryService.ts`.
- Roles involved: `admin`, `chef`, `stock_manager`; global list endpoint is `admin` and `stock_manager` only.
- Happy path: ingredient images are uploaded or generated, local ingredients are edited, and global ingredient catalog is browsed for inventory linking.
- Failure scenarios: mass delete, missing files, generate-image failure, global list disabled by inventory feature, cross-tenant ingredient contamination.
- Permission scenarios: local ingredient CRUD for admin/chef/stock_manager; global inventory catalog for admin/stock_manager.
- Tenant-isolation requirements: tenant ingredients remain separate even when linked to shared global ingredients.
- Edge cases: localized names, missing or inactive images, bulk upload, generate-missing-images batch.
- Current coverage: `IngredientLibraryControllerTest`, `IngredientImageAssetTest`, `GlobalIngredientControllerTest`.
- Missing coverage: frontend ingredient pages, global-image generation failures, large-batch performance, library delete-all behavior is currently failing in tests.
- Risk level: high.

## 11. Inventory, Stock History, Import, and Deduction
- Feature name: inventory catalog, global import, restock/adjust, stock consumption, stock history.
- Relevant files: `Menu_API/app/Http/Controllers/InventoryIngredientController.php`, `Menu_API/app/Http/Controllers/InventoryStockHistoryController.php`, `Menu_API/app/Services/OrderInventoryDeductionService.php`, `Menu_API/app/Models/StockMovement.php`, `Menu_API/app/Models/OrderItemIngredientUsage.php`, `Menu_API/routes/api.php`, `Menu_React/src/pages/AdminIngredientsPage.tsx`, `Menu_React/src/pages/AdminStockHistoryPage.tsx`, `Menu_React/src/pages/AdminIngredientTrackerPage.tsx`, `Menu_React/src/services/orderService.ts`.
- Roles involved: `admin`, `stock_manager`.
- Happy path: admin imports global ingredients, manages local stock, order confirmation deducts stock, cancellation restores it, stock history reflects all movement sources.
- Failure scenarios: inactive ingredient on POS checkout; insufficient stock; duplicate deduction; import duplicates; wrong-tenant import; stock history missing dish attribution.
- Permission scenarios: admin/stock_manager only; some finance lookup endpoints shared with stock_manager.
- Tenant-isolation requirements: inventory movements, imports, and stock history fully scoped to one restaurant.
- Edge cases: packaged drinks vs prepared dishes, direct-stock products, inactive ingredients, import of already-linked catalog items.
- Current coverage: `OrderInventoryDeductionTest`, `InventoryIngredientImportTest`, `InventoryContractsTest`.
- Missing coverage: current import and inventory contract tests are failing; no frontend inventory page tests; no E2E stock-through-order flow.
- Risk level: critical.

## 12. Room Plan Editor
- Feature name: room-plan layout CRUD, background upload, item duplication, table synchronization.
- Relevant files: `Menu_API/app/Http/Controllers/RoomPlanController.php`, `Menu_API/app/Http/Controllers/RoomPlanItemController.php`, `Menu_API/app/Services/RoomPlanService.php`, `Menu_API/app/Services/RoomPlanItemService.php`, `Menu_API/app/Services/RoomPlanTableSyncService.php`, `Menu_API/app/Models/RoomPlan.php`, `Menu_API/app/Models/RoomPlanItem.php`, `Menu_API/routes/api.php`, `Menu_React/src/pages/AdminRoomPlansPage.tsx`, `Menu_React/src/utils/roomPlan.ts`, `Menu_React/src/utils/roomPlanGeometry.ts`, `Menu_React/src/utils/roomPlanEdgeOverlay.ts`, `Menu_React/src/utils/roomPlanWindowSnap.ts`, `Menu_React/src/services/roomPlanService.ts`.
- Roles involved: read for `admin`, `staff`, `chef`, `stock_manager`; write for `admin`, `staff`.
- Happy path: admin/staff create plan, place items, upload background, save layout, and provision restaurant tables from room plan.
- Failure scenarios: invalid coordinates, duplicate items, broken table sync, disabled feature, background upload failure.
- Permission scenarios: only admin/staff mutate; other roles read when feature enabled.
- Tenant-isolation requirements: room plans and generated tables never cross restaurant boundaries.
- Edge cases: non-table room items, inactive tables, switching between manual and room-plan modes.
- Current coverage: `RoomPlanEditorApiTest`, frontend geometry and overlay utilities, `room-plan-reservations.spec.ts` placeholder, `reservationsPage.test.tsx`.
- Missing coverage: full editor UI, background uploads, manual/room-plan switching, realtime interaction with reservations; backend happy path currently failing.
- Risk level: high.

## 13. Table Reservations
- Feature name: public reservation booking plus admin reservation management.
- Relevant files: `Menu_API/app/Http/Controllers/PublicReservationController.php`, `Menu_API/app/Http/Controllers/ReservationController.php`, `Menu_API/app/Services/ReservationService.php`, `Menu_API/app/Services/ReservationAvailabilityService.php`, `Menu_API/app/Models/Reservation.php`, `Menu_API/routes/api.php`, `Menu_React/src/pages/ReservationsPage.tsx`, `Menu_React/src/pages/AdminReservationsPage.tsx`, `Menu_React/src/services/roomPlanService.ts`, `Menu_React/src/services/eventReservationService.ts`.
- Roles involved: guest, `admin`, `staff`, backend mutation group also allows `accountant`.
- Happy path: guest checks availability and reserves a table; admin reviews, updates, cancels, marks busy/completed/no-show.
- Failure scenarios: overlap, non-table room-plan item, feature disabled, cross-midnight conflict, wrong admin role, room-plan mismatch.
- Permission scenarios: guests public-create only; staff can view; admin mutates; current route wiring also exposes mutation endpoints to `accountant`.
- Tenant-isolation requirements: reservation lookups and mutations scoped by room plan and tenant.
- Edge cases: cross-midnight reservations, no-show non-blocking logic, walk-in conversion, partial feature enablement.
- Current coverage: `ReservationApiTest`, frontend `reservationsPage.test.tsx`, skipped E2E room-plan flow.
- Missing coverage: admin reservation UI, permission mismatch between frontend and backend, accountant mutation access, disabled-feature frontend route handling.
- Risk level: high.

## 14. Event Reservations and Planning Alerts
- Feature name: event reservations, menu forecast, order draft generation, alerting.
- Relevant files: `Menu_API/app/Http/Controllers/AdminEventReservationController.php`, `Menu_API/app/Services/EventReservationService.php`, `Menu_API/app/Services/EventPlanningAlertService.php`, `Menu_API/app/Console/Commands/SendEventPlanningReminders.php`, `Menu_API/app/Models/EventReservation.php`, `Menu_API/app/Models/EventMenuItem.php`, `Menu_API/app/Models/EventOrderLink.php`, `Menu_API/app/Models/EventNotificationLog.php`, `Menu_API/app/Events/EventPlanningNotification.php`, `Menu_API/routes/api.php`, `Menu_React/src/pages/AdminEventsPage.tsx`, `Menu_React/src/services/eventReservationService.ts`.
- Roles involved: `admin`, `chef`, `stock_manager`.
- Happy path: operations team creates event booking, sets menu items, reviews forecast, generates order draft, and receives planning reminders.
- Failure scenarios: room-plan mismatch, duplicate reminders, menu-forecast errors, broken alert channels, disabled feature.
- Permission scenarios: only admin/chef/stock_manager when feature enabled.
- Tenant-isolation requirements: event reservations, forecast data, push targets, and notification logs stay inside one restaurant.
- Edge cases: reminder resend suppression, order-draft regeneration, completed/cancelled events.
- Current coverage: `AdminEventReservationApiTest`, frontend `adminEventsPage.test.tsx`.
- Missing coverage: scheduler command path, push and broadcast alert delivery assertions, event-to-order linking lifecycle, UI happy path end-to-end.
- Risk level: high.

## 15. Finance Dashboard, Expenses, Vendors, Tax, Profit and Loss
- Feature name: finance analytics, expenses, vendors, categories, tax report, profit/loss.
- Relevant files: `Menu_API/app/Http/Controllers/InvoiceController.php`, `Menu_API/app/Http/Controllers/FinanceExpenseController.php`, `Menu_API/app/Http/Controllers/FinanceExpenseCategoryController.php`, `Menu_API/app/Http/Controllers/FinanceVendorController.php`, `Menu_API/app/Domain/Finance/FinanceCalculator.php`, `Menu_API/app/Providers/FinanceServiceProvider.php`, `Menu_API/routes/api.php`, `Menu_React/src/pages/AdminFinanceDashboardPage.tsx`, `Menu_React/src/pages/AdminFinanceExpensesPage.tsx`, `Menu_React/src/services/financeReportingService.ts`, `Menu_React/src/services/financeExpenseService.ts`, `Menu_React/src/utils/financeMath.ts`, `Menu_React/src/utils/financeReporting.ts`, `Menu_React/src/utils/financeReportWorkbook.ts`.
- Roles involved: `admin`, `accountant`; some lookup endpoints also permit `stock_manager`.
- Happy path: finance role sees dashboard metrics, reports, vendors/categories, creates expenses, filters by status, exports results.
- Failure scenarios: wrong expense mode, cross-tenant leakage, tax miscalculation, draft/approved mismatch, broken parity between backend and frontend math.
- Permission scenarios: finance endpoints role-gated and feature-gated; stock manager lookup exception for linking restocks.
- Tenant-isolation requirements: every report and entity scoped by restaurant.
- Edge cases: all-non-void expense mode, paid payroll mirror effect on P&L, dual currency, VAT/off-by-one rounding.
- Current coverage: `FinanceDashboardMetricsApiTest`, `FinanceExpenseManagementApiTest`, `FinanceProfitLossApiTest`, `FinanceTaxReportApiTest`, `FinanceParityTest`, frontend finance math and reporting tests.
- Missing coverage: several backend finance tests are currently failing; no frontend dashboard page tests; no export-download integration tests.
- Risk level: critical.

## 16. Payroll and Staff Scheduling
- Feature name: payroll periods, entries, summary, payroll-mirror expenses, staff scheduling.
- Relevant files: `Menu_API/app/Http/Controllers/FinancePayrollController.php`, `Menu_API/app/Http/Controllers/StaffScheduleController.php`, `Menu_API/app/Models/PayrollPeriod.php`, `Menu_API/app/Models/PayrollEntry.php`, `Menu_API/app/Models/StaffShift.php`, `Menu_API/routes/console.php`, `Menu_API/routes/api.php`, `Menu_React/src/pages/AdminPayrollManagementPage.tsx`, `Menu_React/src/pages/AdminStaffSchedulingPage.tsx`, `Menu_React/src/services/payrollService.ts`, `Menu_React/src/services/staffScheduleService.ts`.
- Roles involved: `admin`, `accountant` for payroll; `admin` for staff-scheduling UI.
- Happy path: finance team creates payroll periods, uploads entries, marks paid, mirrors paid payroll into expenses; admin schedules shifts and edits status.
- Failure scenarios: overlap validation, missing employee linkage, adjustment periods on paid periods, negative net pay, cross-tenant user references, invalid shift time windows.
- Permission scenarios: payroll admin/accountant only; staff-scheduling guarded by admin and feature flag in frontend, admin/accountant in backend routes.
- Tenant-isolation requirements: payroll periods, entries, shifts, and mirrored expenses stay within one restaurant.
- Edge cases: query monthly/range modes, weekly splits, custom day blocks, reimbursements/allowances, paid-period adjustments.
- Current coverage: `FinancePayrollApiTest`, `StaffSchedulingApiTest`, frontend `adminPayrollManagementPage.test.tsx` and `adminStaffSchedulingPage.test.tsx`.
- Missing coverage: both frontend page tests are red; backend payroll tests have failing critical cases around employee linkage and adjustments; no E2E finance workflow.
- Risk level: critical.

## 17. Analytics, Realtime, Push, and Broadcast Channels
- Feature name: analytics event tracking, realtime channels, browser push, mobile push token support.
- Relevant files: `Menu_API/app/Http/Controllers/AnalyticsController.php`, `Menu_API/app/Http/Controllers/PushSubscriptionController.php`, `Menu_API/app/Services/WebPushNotificationService.php`, `Menu_API/app/Services/MobilePushNotificationService.php`, `Menu_API/routes/channels.php`, `Menu_API/app/Events/*`, `Menu_React/src/services/realtime.ts`, `Menu_React/src/services/pushNotifications.ts`, `Menu_React/src/hooks/useAnalytics.ts`, `Menu_React/src/services/analyticsService.ts`.
- Roles involved: guest, `staff`, `chef`, `admin`, `accountant`.
- Happy path: guest analytics are tracked, staff/chef/accounting pages receive realtime updates, browser/mobile push delivers service alerts.
- Failure scenarios: missing Reverb key, auth failure on private channels, over-broad channel access, duplicate notifications, stale subscriptions.
- Permission scenarios: private channels should mirror HTTP role rules.
- Tenant-isolation requirements: channel authorization by restaurant and table assignment; event payloads must not leak another tenant’s data.
- Edge cases: disconnected transport fallback, repeated notification tags, mobile token preference flags, staff access to accounting channel.
- Current coverage: indirect coverage inside workflow tests; no dedicated frontend tests.
- Missing coverage: channel authorization matrix, payload confidentiality, push registration, analytics correctness, resilience under reconnect/offline behavior.
- Risk level: critical.

## 18. AI Chatbot, Contact Leads, and Contact-Us Funnel
- Feature name: public AI contact/chat assistant and lead capture.
- Relevant files: `Menu_API/app/Http/Controllers/AiChatController.php`, `Menu_API/app/Http/Controllers/ChatController.php`, `Menu_API/app/Http/Requests/SendAiChatMessageRequest.php`, `Menu_API/app/Http/Requests/SaveContactLeadRequest.php`, `Menu_API/app/Models/ChatSession.php`, `Menu_API/app/Models/ChatMessage.php`, `Menu_API/app/Models/ChatOrder.php`, `Menu_API/app/Models/ContactLead.php`, `Menu_API/app/Mail/NewContactLeadMail.php`, `Menu_React/src/pages/RozerContactAiPage.tsx`, `Menu_React/src/components/ChatBot.tsx`, `Menu_React/src/utils/chatbotRecommendations.ts`, `Menu_React/src/services/superAdminContactRequestsService.ts`.
- Roles involved: guest/public user, `saas_owner` for reviewing leads.
- Happy path: public user opens chatbot or contact page, creates session, sends messages, submits lead, and super admin reviews stored transcript and lead details.
- Failure scenarios: throttling, mail failure, missing session UUID, invalid contact payload, AI service failure.
- Permission scenarios: public chat entrypoints throttled; lead review super-admin only.
- Tenant-isolation requirements: public contact flow on `rozer.pro` must not leak tenant data; lead transcripts tied to correct session.
- Edge cases: resumed session fetch, lead saving before or after chat, mail transport errors, contact requests page only on main domain.
- Current coverage: frontend `chatbotRecommendations.test.ts`; no backend feature tests for chat or contact lead flow.
- Missing coverage: API validation, throttling behavior, mail dispatch, transcript retrieval, super-admin contact-requests UI, public E2E conversion funnel.
- Risk level: medium.

## Incomplete, Duplicated, Unreachable, or Insecure Findings
- Hardcoded frontend feature bypass exists for `admin@alpha.com` in `Menu_React/src/utils/features.ts`; this can hide real feature-flag bugs during manual QA.
- The role model is inconsistent: no `cashier` role exists in backend, but the product and UI include cashier-specific pages and scheduling labels.
- Legacy role aliases remain in both layers: frontend `UserRole` includes `add`, backend normalizes `add`, `stock_manger`, and `accoutant`, which raises data-cleanliness and auth-branch risk.
- `User::currentRestaurant()` resolves to the first owned or staffed restaurant, which is fragile for true multi-tenant staff accounts.
- `routes/channels.php` allows ordinary `staff` into the accounting private channel even though finance HTTP endpoints are admin/accountant only.
- Only two Laravel `FormRequest` classes exist for a 203-route API, so validation is mostly controller-local and harder to keep consistent.
- No Laravel policies, API resources, listeners, or notification classes were found; authorization and serialization are largely ad hoc.
- The backend migration tree contains both active migrations and a duplicate `database/migrations/current` folder, plus a typo file `create_dish_assets_table.php.php`.
- Frontend `/admin/reservations` route is not feature-gated, even though the backend reservation endpoints are behind `table_reservations`.
- E2E coverage is effectively absent because the only Playwright spec is permanently skipped.
jlkimj v
