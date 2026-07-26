# Launch Test Strategy

Audit date: July 24, 2026.

## System Scope

Discovered applications:
- `Menu_React`: React 19 + TypeScript + Vite web SPA for guests, staff, admin, accountant, chef, stock manager, and super admin flows.
- `Menu_API`: Laravel 12 API with Sanctum auth, Reverb broadcasting, queue worker support, scheduler support, Vite assets, and MySQL-backed tenancy.
- Not found in the inspected repositories: React Native/mobile application source. The backend contains `mobile_push_tokens` support, so a mobile client is likely planned or lives in another repository.

Direct packages and frameworks:
- Frontend runtime: `react`, `react-dom`, `react-router-dom`, `axios`, `i18next`, `react-i18next`, `laravel-echo`, `pusher-js`, `chart.js`, `react-chartjs-2`, `exceljs`, `file-saver`, `framer-motion`, `html2canvas`, `jspdf`, `three`, `@google/model-viewer`, `lucide-react`.
- Frontend test/tooling: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `playwright`, `eslint`, `typescript`, `tailwindcss`, `vite`.
- Backend PHP runtime: `laravel/framework`, `laravel/sanctum`, `laravel/reverb`, `endroid/qr-code`, `jenssegers/agent`, `minishlink/web-push`, `pusher/pusher-php-server`.
- Backend PHP dev: `phpunit`, `fakerphp/faker`, `mockery`, `laravel/pint`, `laravel/pail`, `laravel/sail`.
- Backend JS/tooling: `vite`, `laravel-vite-plugin`, `axios`, `concurrently`, `tailwindcss`.
- Infrastructure in repo: MySQL, Laravel queue worker, Laravel scheduler, Reverb websocket server. Redis is configurable in Laravel config but is not part of the provided compose stacks.

## Repository Inventory

High-level counts:
- API routes: 203 generated routes from `php artisan route:list --path=api --json`.
- Backend controllers: 38.
- Backend services: 26.
- Backend models: 46.
- Backend form requests: 2.
- Backend middleware: 6.
- Backend jobs: 1.
- Backend events: 8.
- Backend migrations: 93.
- Backend seeders: 19.
- Backend factories: 1.
- Frontend pages: 46.
- Frontend services/API clients: 24.

Routes by major area:
- Public auth/chat: `/api/auth/*`, `/api/chat`, `/api/ai-chat/*`.
- Public guest menu: `/api/menu/*`, `/api/test*`, `/api/assets/{asset}/file`, `/api/analytics/track`.
- Public reservations: `/api/reservations/*`.
- Guest-session protected: `/api/table-session/{tableSession}/*`.
- Super admin/owner: `/api/owner/*`, `/api/super-admin/*`.
- Staff operations: `/api/orders/pending-confirmation`, `/api/table-sessions/*`, `/api/waves/*`, `/api/push/*`.
- Room plan and reservations admin: `/api/room-plans*`, `/api/admin/reservations*`.
- Finance: `/api/orders/accounting`, `/api/admin/finance/*`, `/api/pos/checkout`.
- Restaurant setup: `/api/restaurant/*`, `/api/restaurant/staff*`, `/api/restaurant/tables/*/qr-*`.
- Events: `/api/admin/events*`.
- Dishes/menu items: `/api/dishes*`, `/api/menu-items*`, `/api/admin/menu-item-templates*`.
- Ingredients/inventory: `/api/ingredients*`, `/api/global-ingredients`, `/api/inventory/*`.
- Kitchen: `/api/kitchen/orders*`.

Primary controllers:
- `AuthController`, `SuperAdminAuthController`, `SuperAdminFeatureFlagController`, `SuperAdminRestaurantManagementController`, `SuperAdminContactLeadController`.
- `GuestController`, `MenuController`, `GuestTableAccessController`, `TableSessionController`, `OrderController`, `WaveController`, `PushSubscriptionController`.
- `DishController`, `AssetController`, `AssetFileController`, `IngredientLibraryController`, `GlobalIngredientController`, `InventoryIngredientController`, `InventoryStockHistoryController`.
- `RoomPlanController`, `RoomPlanItemController`, `PublicReservationController`, `ReservationController`, `AdminEventReservationController`.
- `RestaurantController`, `CurrencySettingsController`, `QRCodeController`, `AnalyticsController`.
- `InvoiceController`, `FinanceExpenseController`, `FinanceExpenseCategoryController`, `FinanceVendorController`, `FinancePayrollController`, `StaffScheduleController`.
- `AiChatController`, `ChatController`.

Primary services:
- Tenancy and flags: `TenantRestaurantResolver`, `FeatureFlagService`, `RestaurantFeatureFlagScope`, `RestaurantCustomDomainService`, `DomainProvisioner`.
- Guest and staff operations: `GuestMenuSessionService`, `TableSessionAccessService`, `StaffCapabilityService`, `TableManagementModeService`, `TableProvisioningService`.
- Room plans and reservations: `RoomPlanService`, `RoomPlanItemService`, `RoomPlanTableSyncService`, `ReservationService`, `ReservationAvailabilityService`, `EventReservationService`, `EventPlanningAlertService`.
- Commerce and finance: `OrderInvoiceCalculator`, `InvoiceSplitService`, `OrderInventoryDeductionService`, `FinanceCalculator`.
- Ingredients and AI: `GlobalIngredientProvisioningService`, `DishDescriptionGenerationService`, `DishAlternativeSuggestionService`, `DeepSeekChatService`.
- Realtime and push: `WebPushNotificationService`, `MobilePushNotificationService`.

Models:
- Tenancy and auth: `User`, `SuperAdmin`, `Restaurant`, `RestaurantDomain`, `RestaurantFeature`, `Feature`, `FeatureFlagAuditLog`.
- Menu and media: `Dish`, `DishAsset`, `DishIngredient`, `Ingredient`, `GlobalIngredient`, `QrCode`.
- Orders and table ops: `Order`, `OrderItem`, `OrderItemIngredientUsage`, `Invoice`, `InvoiceItem`, `TableSession`, `TableGuestAccess`, `TableWave`, `RestaurantTable`.
- Inventory and finance: `StockMovement`, `Expense`, `ExpenseAttachment`, `ExpenseCategory`, `Vendor`, `PayrollPeriod`, `PayrollEntry`, `StaffShift`.
- Reservations and events: `RoomPlan`, `RoomPlanItem`, `Reservation`, `EventReservation`, `EventMenuItem`, `EventOrderLink`, `EventNotificationLog`.
- Chat and analytics: `AnalyticsEvent`, `ChatSession`, `ChatMessage`, `ChatOrder`, `ContactLead`, `PushSubscription`, `MobilePushToken`, `Scan`, `ScanJob`.

Validation classes:
- `Menu_API/app/Http/Requests/SaveContactLeadRequest.php`
- `Menu_API/app/Http/Requests/SendAiChatMessageRequest.php`

Middleware:
- `SetRequestLocale`
- `EnsureGuestTableAccess`
- `EnsureUserHasRole`
- `EnsureSaasOwner`
- `EnsureRestaurantFeatureEnabled`
- `RestrictChefApiSurface`

Jobs, events, mail:
- Job: `ProvisionRestaurantDomainJob`
- Events: `AccountingOrderCreated`, `AccountingOrderRemoved`, `KitchenOrderCreated`, `KitchenOrderUpdated`, `KitchenOrderReady`, `TableWaveCreated`, `TableWaveResolved`, `EventPlanningNotification`
- Mail: `NewContactLeadMail`

Not found:
- `app/Policies`
- `app/Listeners`
- `app/Notifications`
- `app/Http/Resources`
- Mobile screens or React Native application source in the inspected repos

Frontend pages:
- Guest: `GuestDishListPage`, `GuestDishPage`, `GuestDishIngredientsPage`, `GuestOrdersPage`, `GuestInvoicePage`, `OrderReviewPage`, `ReservationsPage`, `InvoicePrintPage`, `RozerContactAiPage`.
- Staff/admin ops: `AdminDashboard`, `StaffOrdersPage`, `TodayOrdersPage`, `TodayOrderDetailsPage`, `CashierPosPage`, `ChefDashboardPage`, `KitchenOrderHistoryPage`.
- Back office: `AdminRestaurantProfilePage`, `AdminUserProfilePage`, `AdminDishPage`, `CreateDishPage`, `EditDishPage`, `IngredientLibrary`, `IngredientLibraryPage`, `GlobalIngredientsPage`, `AdminIngredientsPage`, `AdminStockHistoryPage`, `AdminIngredientTrackerPage`, `AdminStaffPage`, `AdminStaffSchedulingPage`, `AdminRoomPlansPage`, `AdminReservationsPage`, `AdminEventsPage`, `AdminCurrencyPage`.
- Finance: `AccountingOrdersPage`, `AdminFinanceDashboardPage`, `AdminFinanceExpensesPage`, `AdminFinanceInvoiceDetailsPage`, `AdminPayrollManagementPage`.
- Super admin: `SuperAdminLoginPage`, `SuperAdminDashboardPage`, `SuperAdminRestaurantSetupPage`, `SuperAdminRestaurantsPage`, `SuperAdminContactRequestsPage`, `SuperAdminContactRequestDetailsPage`.
- Misc: `LiquidGlassDemoPage`, `LoginPage`.

Frontend API clients/services:
- Core: `api`, `realtime`, `offlineQueue`, `offlineStore`.
- Domain services: `orderService`, `invoiceService`, `roomPlanService`, `eventReservationService`, `staffService`, `staffScheduleService`, `payrollService`, `financeExpenseService`, `financeReportingService`, `restaurantProfileService`, `tableManagementService`, `ingredientLibraryService`, `analyticsService`, `dishDescriptionService`, `complaintCompensationService`.
- Super admin: `superAdminApi`, `superAdminFeatureFlagsService`, `superAdminRestaurantSetupService`, `superAdminContactRequestsService`.
- Browser integration: `pushNotifications`.

Feature flags:
- `qr_menu`
- `table_ordering`
- `waiter_call`
- `request_bill`
- `inventory`
- `ingredient_stock_deduction`
- `finance_dashboard`
- `vat_invoices`
- `expense_management`
- `payroll_management`
- `dish_profitability`
- `invoice_splitting`
- `ai_recommendations`
- `ai_chatbot`
- `ar_3d_dishes`
- `animated_ingredients`
- `push_notifications`
- `realtime_staff_orders`
- `room_plan_editor`
- `table_reservations`
- `event_reservations`
- `staff_scheduling`
- `analytics`
- `multi_language`
- `custom_domain`

## Roles and Effective Permissions

Observed roles in code:
- `saas_owner`
- `restaurant_admin` alias normalized to admin
- `admin`
- `staff`
- `chef`
- `stock_manager`
- `accountant`

Legacy/dirty role values still handled:
- `add` treated as admin in frontend and backend
- `stock_manger` normalized to `stock_manager`
- `accoutant` normalized to `accountant`

Observed permission model:
- `saas_owner`: super-admin auth, restaurant provisioning, feature flags, contact-lead review, domain lifecycle.
- `admin`: full tenant back-office access including staff management, dishes, orders, accounting, room plans, reservations, events, inventory, finance, QR, profile.
- `staff`: pending orders, assigned tables, waves, active sessions, reservation view, limited order access by table assignment.
- `chef`: kitchen queue/history, some dish access, event reservations, room-plan read.
- `stock_manager`: inventory, global ingredient catalog, event reservations, room-plan read, limited finance lookups.
- `accountant`: accounting queue, finance dashboard, expenses, vendors/categories, invoices, payroll, restaurant profile/currency, staff list.

Permission mismatches to treat as defects:
- No real `cashier` role exists, but POS and scheduling terminology assume one.
- Frontend `/staff/pos` is admin-only, while backend `POST /api/pos/checkout` also allows `staff`, `chef`, and `stock_manager`.
- Frontend `/admin/reservations` is accessible without checking `table_reservations`, while backend reservation routes are feature-gated.
- Backend accounting broadcast channel currently allows `staff`, wider than finance HTTP endpoints.

## Major Business Workflows

1. Tenant onboarding
- Super admin logs in.
- Creates admin user and restaurant.
- Enables feature flags.
- Optionally assigns custom domain and queues provisioning.

2. Guest menu journey
- Guest reaches restaurant via slug, host, or QR table URL.
- Menu and dish pages resolve tenant.
- Dish detail optionally shows ingredients, AR, and recommendations.

3. Table session journey
- Staff activates table session and receives PIN.
- Guest verifies PIN.
- Session grants order, waiter-call, bill-request, and invoice-split capabilities.

4. Order-to-service flow
- Guest or staff creates order.
- Waiter/staff confirms or edits pending order.
- Chef processes kitchen queue.
- Staff serves items and closes session.

5. Accounting and invoicing
- Confirmed staff orders enter accounting queue.
- Finance role applies tax, discount, compensation, and split context.
- Invoice is issued or paid.
- Accounting can spawn linked expense entries for goodwill/loss handling.

6. Inventory consumption
- Published dish recipes map to ingredient inventory.
- Order confirmation deducts stock.
- Order cancellation restores stock.
- Stock history and restock/adjust actions maintain auditability.

7. Room plan and reservations
- Admin/staff creates room plans and table items.
- Public users check availability and reserve tables.
- Admin updates reservation status through the service lifecycle.

8. Event operations
- Admin/chef/stock manager creates event reservation.
- Event menu and forecast are prepared.
- Planning reminders are broadcast and pushed.
- Order draft can be generated from event planning.

9. Finance operations
- Expense categories and vendors maintained.
- Expenses, P&L, dashboard metrics, and tax reports consumed by finance roles.
- Payroll periods mirror into expenses after payment.

10. Marketing/contact funnel
- Public user interacts with AI contact/chat flow.
- Lead is stored and mailed.
- Super admin reviews contact requests and transcript context.

## Existing Test Assets

Backend tests:
- PHPUnit with `tests/Feature` and `tests/Unit`.
- Strongest existing areas: finance calculations/reporting, reservations, room-plan editor, inventory deduction, custom domain provisioning, tenant routing, order workflows, ingredient/media flows.
- Execution status on July 24, 2026: 83 passing, 60 failing.

Frontend tests:
- Vitest + Testing Library.
- Existing unit coverage focuses on finance math/reporting, reservation page behavior, room-plan utilities, compensation logic, events page, payroll/scheduling pages, POS page.
- Execution status on July 24, 2026: 15 passing files, 3 failing files, 55 passing tests, 6 failing tests.

E2E tests:
- Playwright present.
- Only one spec: `tests/e2e/room-plan-reservations.spec.ts`.
- Current state: explicitly skipped because it depends on a running backend and seeded credentials.

Factories:
- Only one factory exists: `database/factories/UserFactory.php`.
- This is insufficient for broad, low-friction domain test generation.

Seeders:
- 19 seeders, including demo and scenario-heavy seeders for features, domains, ingredients, finance, and realistic tenant data.
- Useful for QA sandboxes but too environment-coupled to rely on as the main automated test data mechanism.

Fixtures:
- Backend: `tests/Fixtures/financeBackendParity.json`.
- Frontend: `tests/unit/fixtures/financeBackendParity.json`, `financeRegressionFixtures.ts`.
- Fixture strategy is narrow and finance-specific.

CI configuration:
- No `.github/workflows` or other CI config found in either repository.
- There is no repository-native automated gate for tests, lint, or smoke deploy checks.

## Test Types

1. Backend API integration tests
- Primary confidence layer for business rules, tenancy, permissions, and database side effects.
- Use real database transactions and minimal mocking.

2. Frontend component and page tests
- Focus on route guards, state transitions, form validation, and rendering under realistic providers.
- These are currently underpowered and partially broken.

3. Domain parity tests
- Keep finance-math parity between frontend and backend locked using shared fixtures.
- Expand this pattern to invoice split, compensation buckets, and currency conversions.

4. Realtime and channel authorization tests
- Add backend tests for broadcasting auth and payload visibility.
- Add frontend tests for reconnect behavior and event handling reducers.

5. Browser E2E tests
- Add only a small but high-value suite that covers launch-blocking customer journeys.
- Avoid broad flaky end-to-end sprawl.

6. Smoke and operational tests
- Scheduler command smoke, queue job smoke, custom-domain provisioning stubs, mail/sendability checks, push registration smoke.

## Test Environments

Local development:
- React app against local API.
- Backend on MySQL with Reverb available.
- Suitable for debugging but not authoritative for release.

CI environment:
- Ephemeral MySQL database.
- Backend test runner with migrations from scratch.
- Frontend unit tests in jsdom.
- Headless browser for Playwright.

Pre-release staging:
- Production-like MySQL.
- Queue worker and scheduler enabled.
- Reverb enabled.
- Feature flags and tenant/domain setup mirroring launch tenants.
- Seeded with controlled, anonymized multi-tenant data.

Launch rehearsal environment:
- Same deployment topology as production.
- Realistic domains/subdomains.
- Synthetic guest traffic, staff traffic, and finance operations executed before each controlled release.

## Database Strategy

Automated backend tests:
- Keep `RefreshDatabase` for API tests.
- Add factories for `Restaurant`, `RestaurantTable`, `Dish`, `Order`, `Invoice`, `Reservation`, `Expense`, `PayrollPeriod`, `RoomPlan`, `EventReservation`.
- Stop relying on scenario seeders for the majority of automated tests.

Multi-tenant data:
- Always create at least two restaurants in tenant-sensitivity tests.
- Assert negative cases explicitly: wrong host, wrong slug, wrong table, wrong order, wrong room plan.

Reporting data:
- Use deterministic factories/fixtures with explicit dates and cents-level values.
- Validate both totals and line-item/source associations.

Migration hygiene:
- Clean up duplicate migration archive content and the typo-named migration file before launch freeze, or at minimum mark them non-authoritative in developer docs.

## Mocking Strategy

Mock sparingly:
- Mock only external or operational boundaries: AI providers, mail transport, web push gateways, mobile push transport, domain-provisioning process execution, and possibly Reverb transport.

Do not mock:
- Tenancy resolution.
- Authorization and middleware.
- Database side effects for orders, invoices, payroll, reservations, inventory.
- Finance calculation logic.

Frontend mocks:
- Mock network boundaries but keep provider stack real.
- Standardize test render helpers with `AuthProvider`, `AppThemeProvider`, and i18n initialization so page tests stop failing for harness reasons.

## E2E Strategy

Core E2E flows to automate first:
1. Super admin creates restaurant, enables core launch flags, and admin logs in.
2. Admin creates room plan and publishes menu items.
3. Staff activates table session; guest unlocks with PIN, places order, and calls waiter.
4. Staff confirms order; chef marks ready; staff serves.
5. Accountant/admin finalizes invoice and sees correct totals.
6. Guest reservation availability updates after reservation creation.

E2E rules:
- Keep browser tests small in number and deterministic.
- Use seeded, disposable tenants.
- Include host-based tenant routing in at least one test.
- Fail fast on console errors and network 4xx/5xx outside expected negative assertions.

## Critical Business Flows

Launch-blocking flows:
- Tenant resolution by host/slug/table must never leak data.
- Guest PIN verification and protected session access.
- Guest order creation to staff confirmation.
- Kitchen preparation to served transition.
- Accounting finalization and invoice math.
- Inventory deduction/restoration correctness.
- Reservation availability and overlap protection.
- Super-admin feature toggles and custom-domain provisioning.

Important but non-blocking for initial controlled launch if explicitly disabled:
- AI chatbot/contact funnel.
- AR/3D dish presentation.
- Browser/mobile push notifications beyond core realtime UI.

## Regression Strategy

Every release candidate must run:
- Backend full suite.
- Frontend unit suite.
- Targeted Playwright launch-blocker suite.
- Lint/build for frontend and backend assets.

Every bug fix in critical domains must add:
- One direct regression test at API level.
- One UI or E2E regression test if the bug was user-visible.

Shared-math policy:
- When finance logic changes, update backend and frontend parity fixtures in the same change.
- Reject changes that alter finance outputs without fixture review.

Authorization policy:
- Every new route for restricted roles must come with explicit tests for allowed and disallowed roles.
- Every new tenant-scoped endpoint must include at least one cross-tenant negative assertion.

## CI Strategy

Minimum required pipeline to add before launch:
1. Frontend install, lint, build, unit tests.
2. Backend composer install, Pint or PHP linting, migrations, PHPUnit suite.
3. Playwright smoke on a composed preview environment.
4. Artifact retention for failing screenshots, traces, and test logs.

Pipeline gates:
- No deploy when any backend feature test fails.
- No deploy when any frontend unit test fails.
- No deploy when launch-blocker Playwright tests fail.
- No deploy when migrations are pending or production config cannot boot.

## Highest-Risk Areas

Top ten risks:
1. Hardcoded frontend feature bypass for `admin@alpha.com` can conceal real tenant flag problems.
2. `User::currentRestaurant()` uses first-match semantics, which is unsafe for true multi-tenant staff memberships.
3. Core guest session and ordering flows are not green; `TableSessionSecurityTest`, `OrderWorkflowTest`, and `WaveWorkflowTest` currently fail extensively.
4. Backend finance/payroll test suite is red in key launch-sensitive cases, including payroll creation and profit/loss behavior.
5. Frontend page tests are red due to missing provider/i18n harness and stale assertions, so UI regression confidence is low.
6. Accounting broadcast channel currently admits `staff`, wider than finance HTTP permissions.
7. Role taxonomy is inconsistent: no first-class cashier role, while UI and workflows depend on cashier semantics.
8. Validation architecture is thin: only two `FormRequest` classes cover a 203-route API.
9. No CI pipeline exists, so broken tests can reach release branches unnoticed.
10. E2E coverage is effectively absent; the only Playwright test is skipped.

## Launch-Blocking Conditions

Block launch if any of the following is true:
- Full backend suite is not green for core domains: tenancy, sessions, ordering, inventory, finance, payroll, reservations, super admin.
- Frontend unit suite is red on launch-critical pages or shared finance/ordering utilities.
- No passing E2E path exists for guest order -> staff confirm -> kitchen -> invoice.
- Cross-tenant negative tests fail or are missing for new tenant-scoped code.
- Feature-flag bypasses or broad auth exceptions remain in production code without explicit business approval.
- No CI gate exists for tests and build.
- Queue/scheduler/realtime stack has not been smoke-tested in a staging environment.

## Recommended Order for Remaining Testing Work

1. Stabilize the current suites before adding breadth: fix the 60 failing backend tests and 6 failing frontend tests.
2. Remove or neutralize test-environment bypasses and auth mismatches: hardcoded full feature access, route/role inconsistencies, accounting channel overexposure.
3. Build missing factories and shared test helpers so new coverage is cheap to add.
4. Lock down core tenant/session/order/invoice/inventory flows with green API tests.
5. Add a minimal passing Playwright launch-blocker suite for the end-to-end service path.
6. Expand finance/payroll UI tests once backend calculations and API contracts are stable.
7. Add realtime/push/channel authorization tests.
8. Add public contact/chat and super-admin contact-review coverage.
9. Add non-critical experience coverage such as AR, translated guest UX, and cosmetic admin pages.
10. Add CI and require it for every release candidate.
