# Authentication, Authorization, and Tenancy Review

Review date: Friday, July 24, 2026

Backend reviewed: `/media/raed/Data/from ubuntu/new_menu/Menu_API`

## Scope

This review inspected:

- authentication entrypoints and token handling
- role and feature-gate middleware
- tenant resolution and restaurant scoping
- route-model-bound protected endpoints
- file URL access paths
- existing tenancy/security feature tests

Tenant isolation was treated as launch-critical.

## Implemented roles found in code

The codebase currently implements these authenticated roles:

- `saas_owner`
- `admin`
- `restaurant_admin` (normalized to `admin`)
- `staff`
- `chef`
- `stock_manager`
- `accountant`

Not implemented in the authenticated API surface:

- `owner`
- `manager`
- `waiter`
- `cashier`
- generic authenticated `guest`

`guest` behavior exists only as unauthenticated/public table-menu flows guarded by table-session access, not as a normal API role.

## Authentication findings

### Confirmed defect 1: restaurant login had no brute-force throttling

Affected route:

- `POST /api/auth/login`

Root cause:

- `routes/api.php` exposed the normal restaurant login route without `throttle:*`
- `AppServiceProvider` defined `owner-login` throttling, but nothing for standard restaurant login

Risk:

- unlimited repeated failed login attempts against restaurant user accounts

Fix applied:

- added `throttle:login` to `POST /api/auth/login`
- added a `login` rate limiter keyed by normalized email-or-phone plus client IP

### Authentication behaviors present vs missing

Present in code:

- valid login via `AuthController@login`
- invalid credential rejection
- token logout via current token deletion
- revoked token rejection through Sanctum
- malformed token rejection through Sanctum
- unauthenticated protected route rejection via API auth exception rendering

Not implemented as of Friday, July 24, 2026:

- disabled user state for restaurant users
- token expiration enforcement in current runtime config
- session refresh endpoint
- password-reset API flow

Evidence:

- no disabled flag/status on `users`
- `config/sanctum.php` sets `expiration => null`
- no auth refresh route
- no password-reset controller/routes

## Authorization and tenant-isolation findings

### Confirmed defect 2: direct asset file IDOR

Affected route:

- `GET /api/assets/{asset}/file`

Root cause:

- `AssetFileController@show` streamed files directly from a route-model-bound `DishAsset`
- the route was public
- there was no signed URL check, auth check, restaurant ownership check, or publish-state check

Impact:

- anyone who knew or guessed a `dish_assets.id` could download another tenant’s dish asset file
- this bypassed tenant isolation through direct IDs and file URLs

Fix applied:

- `DishAsset::getFileUrlAttribute()` now emits temporary signed URLs
- `AssetFileController@show` now allows access only when:
  - the request carries a valid signature, or
  - the authenticated user belongs to the same restaurant as the asset’s dish
- otherwise it returns `404`

### Existing tenancy protections observed

The backend already contains explicit restaurant ownership checks in many protected controllers and services, including:

- orders
- invoices
- finance expenses
- finance vendors
- finance expense categories
- finance payroll periods
- inventory ingredients
- ingredient library
- room plans
- room plan items
- table sessions
- waves
- reservations
- admin event reservations

WebSocket channel authorization also checks tenant and role alignment in `routes/channels.php`.

Existing feature tests already cover important tenancy/feature boundaries, including:

- `tests/Feature/TenantDomainRoutingTest.php`
- `tests/Feature/TableSessionSecurityTest.php`
- `tests/Feature/Finance/FinanceExpenseManagementApiTest.php`
- `tests/Feature/Finance/FinancePayrollApiTest.php`
- `tests/Feature/Finance/StaffSchedulingApiTest.php`
- `tests/Feature/RoomPlanEditorApiTest.php`
- `tests/Feature/ReservationApiTest.php`

## Tests added

Added:

- `tests/Feature/AuthSecurityTest.php`
  - `test_valid_login_returns_token_and_authenticated_user_payload`
  - `test_invalid_login_is_rejected`
  - `test_logout_revokes_current_token`
  - `test_revoked_token_cannot_access_protected_routes`
  - `test_malformed_token_is_rejected`
  - `test_unauthenticated_access_is_rejected`
  - `test_repeated_failed_login_attempts_are_rate_limited`

- `tests/Feature/AssetFileControllerTest.php`
  - `test_unsigned_public_asset_urls_are_not_directly_readable_by_id`
  - `test_authenticated_same_tenant_user_can_read_unsigned_asset_url`
  - `test_authenticated_other_tenant_user_cannot_read_unsigned_asset_url`
  - updated the existing public asset test to use the signed URL form

- `tests/Feature/PreviewImageAssetUploadTest.php`
  - updated URL expectation to account for signed asset URLs

## Defects fixed

- Added brute-force protection to `POST /api/auth/login`
- Closed unauthenticated cross-tenant asset-file access by direct asset ID

## Remaining risks

- Launch-critical: I could not complete a full executable endpoint-by-endpoint authz matrix in this workspace because the configured MySQL test environment was unavailable.
- Launch-critical: the codebase still has no disabled-user control for restaurant users.
- Launch-critical: token expiry is not enforced in the active Sanctum configuration.
- Medium risk: the review did not fully execute export/PDF/file job paths across every tenant-bound resource listed in the request because of the database blocker.
- Medium risk: cache/job/notification isolation was inspected structurally, but not fully exercised end-to-end in runtime tests in this workspace.

## Commands executed

Executed during the review:

- `rg --files`
- `rg -n "auth|tenant|restaurant_id|role|permission|middleware|policy|guard|sanctum|passport|jwt|token|feature" ...`
- `sed -n ... routes/api.php`
- `sed -n ... app/Http/Controllers/AuthController.php`
- `sed -n ... app/Services/TenantRestaurantResolver.php`
- `sed -n ... app/Http/Middleware/EnsureUserHasRole.php`
- `sed -n ... app/Http/Middleware/EnsureRestaurantFeatureEnabled.php`
- `sed -n ... app/Http/Middleware/RestrictChefApiSurface.php`
- `sed -n ... routes/channels.php`
- `sed -n ... app/Http/Controllers/AssetFileController.php`
- `sed -n ... app/Http/Controllers/AssetController.php`
- `sed -n ... app/Http/Controllers/QRCodeController.php`
- `sed -n ... tests/Feature/...`
- `php artisan test tests/Feature/AuthSecurityTest.php`
- `php artisan test tests/Feature/AssetFileControllerTest.php`
- `php artisan test tests/Feature/PreviewImageAssetUploadTest.php`
- `php artisan migrate:fresh --env=testing`
- `docker ps`
- `docker compose -f docker-compose.dev.yml up -d db`
- `env DB_CONNECTION=sqlite DB_DATABASE=':memory:' php artisan test tests/Feature/AuthSecurityTest.php`
- `php -l app/Http/Controllers/AssetFileController.php`
- `php -l app/Models/DishAsset.php`
- `php -l app/Providers/AppServiceProvider.php`
- `php -l tests/Feature/AuthSecurityTest.php`
- `php -l tests/Feature/AssetFileControllerTest.php`
- `php -l tests/Feature/PreviewImageAssetUploadTest.php`

## Passing and failing results

Passing:

- `php -l app/Http/Controllers/AssetFileController.php`
- `php -l app/Models/DishAsset.php`
- `php -l app/Providers/AppServiceProvider.php`
- `php -l tests/Feature/AuthSecurityTest.php`
- `php -l tests/Feature/AssetFileControllerTest.php`
- `php -l tests/Feature/PreviewImageAssetUploadTest.php`

Failing or blocked:

- `php artisan test tests/Feature/AuthSecurityTest.php`
  - first run was contaminated by parallel `RefreshDatabase` suites against the same MySQL test DB
  - later reruns were blocked because MySQL on `127.0.0.1:3306` was unavailable

- `php artisan test tests/Feature/AssetFileControllerTest.php`
  - failed during schema reset because parallel `RefreshDatabase` suites corrupted the shared test DB state

- `php artisan test tests/Feature/PreviewImageAssetUploadTest.php`
  - failed during schema bootstrap because the shared MySQL test DB was left inconsistent

- `php artisan migrate:fresh --env=testing`
  - failed with MySQL connection error to `127.0.0.1:3306`

- `docker compose -f docker-compose.dev.yml up -d db`
  - started but did not complete in a usable time window because the MySQL image pull was still in progress when stopped

- `env DB_CONNECTION=sqlite DB_DATABASE=':memory:' php artisan test tests/Feature/AuthSecurityTest.php`
  - failed because this PHP build does not have the `pdo_sqlite` driver installed

## Files changed

Backend:

- `routes/api.php`
- `app/Providers/AppServiceProvider.php`
- `app/Models/DishAsset.php`
- `app/Http/Controllers/AssetFileController.php`
- `tests/Feature/AuthSecurityTest.php`
- `tests/Feature/AssetFileControllerTest.php`
- `tests/Feature/PreviewImageAssetUploadTest.php`
