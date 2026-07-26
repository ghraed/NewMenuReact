# Test Environment

Scope: backend test infrastructure for `Menu_API`, documented from the `Menu_React` workspace on July 24, 2026.

## What Was Configured

Backend safety and test infrastructure now includes:
- Dedicated testing env file: `Menu_API/.env.testing`
- Fast-fail safety guard: `Menu_API/app/Providers/TestingSafetyServiceProvider.php`
- Shared base test setup: `Menu_API/tests/TestCase.php`
- Expanded factory surface for tenant and business-domain records
- Smoke suite: `Menu_API/tests/Feature/TestEnvironmentSmokeTest.php`

Safe defaults enforced for tests:
- database: dedicated test schema expected
- storage: local testing-only roots under `storage/framework/testing/disks/*`
- mail: `array`
- notifications: faked in base `TestCase`
- queues: `sync`
- broadcasting: `null`
- cache: `array`
- session: `array`
- outbound HTTP: blocked by `Http::preventStrayRequests()`
- time: frozen in base `TestCase` to `2026-01-15 12:00:00 UTC`

## Setup Commands

From `Menu_API`:

```bash
composer install
npm install
```

Create the dedicated MySQL test database and grant the app user access:

```bash
mysql -uroot -p
CREATE DATABASE IF NOT EXISTS restaurantdb_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON restaurantdb_test.* TO 'menu_user'@'localhost';
GRANT ALL PRIVILEGES ON restaurantdb_test.* TO 'menu_user'@'127.0.0.1';
FLUSH PRIVILEGES;
```

Then reset the test schema:

```bash
php artisan migrate:fresh --env=testing
```

## Environment Variables

Primary testing variables now expected:

```env
APP_ENV=testing
APP_URL=http://testing.local

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=restaurantdb_test
DB_USERNAME=menu_user
DB_PASSWORD=

CACHE_STORE=array
SESSION_DRIVER=array
QUEUE_CONNECTION=sync
BROADCAST_CONNECTION=null
MAIL_MAILER=array
FILESYSTEM_DISK=local
```

Testing env also clears or neutralizes external-service credentials:
- AWS / B2 storage keys
- Pusher / Reverb app credentials
- DeepSeek API key
- Web push keys
- FCM credentials
- Postmark / Resend keys

## Database Reset Process

Reset the dedicated test schema:

```bash
php artisan migrate:fresh --env=testing
```

Run a single test class after reset:

```bash
php artisan test tests/Feature/TestEnvironmentSmokeTest.php
```

Important:
- the safety guard rejects databases whose names do not clearly include `test`, `testing`, or `ci`
- `restaurantdb` is intentionally rejected
- tests should continue using `RefreshDatabase` where database isolation is needed

## Test Commands

Backend smoke suite:

```bash
php artisan test tests/Feature/TestEnvironmentSmokeTest.php
php artisan test tests/Unit/DomainNameTest.php
```

Backend full suite:

```bash
php artisan test
```

Frontend unit suite:

```bash
cd /media/raed/Data/from\ ubuntu/new_menu/Menu_React
npm run test:unit
```

Frontend E2E suite:

```bash
cd /media/raed/Data/from\ ubuntu/new_menu/Menu_React
npm run test:e2e
```

## Safety Protections

The testing safety provider now fails immediately when:
- `APP_ENV=production`
- the app is not actually running in `testing`
- the configured database is not clearly a test database
- mail is configured to anything other than `array` or `log`
- queue is configured to anything other than `sync` or `null`
- broadcasting is configured to anything other than `null` or `log`
- the default filesystem disk is not `local` or `public`
- non-placeholder storage, notification, payment, or external API credentials are present during tests
- Redis points to a non-local host or URL during tests

Base test protections:
- `Http::preventStrayRequests()` blocks accidental live API calls
- `Mail::fake()` prevents real mail delivery
- `Notification::fake()` prevents real notifications
- time is frozen globally unless a test overrides it explicitly

## Factory Coverage

Added or improved factory support for:
- restaurants
- users
- roles via user states
- feature flags
- room plans
- room plan items
- restaurant tables
- menu categories via `Database\Factories\MenuCategoryFactory`
- dishes
- ingredients
- recipes via `DishIngredientFactory`
- orders
- order items
- invoices
- reservations
- expenses
- payroll periods
- staff shifts

Notes:
- there is no standalone subscription-plan model in this repository
- menu categories are string fields on dishes, so a small helper factory was added instead of an Eloquent model factory

## Determinism and Independence

Current test infrastructure now supports:
- deterministic time through a frozen base clock
- no real outbound HTTP by default
- isolated local storage roots for tests
- database reset through `RefreshDatabase`
- independent fixture creation through explicit factories instead of scenario seeders

Recommended conventions for new backend tests:
- use `RefreshDatabase`
- create data through factories, not shared seed state
- fake only the specific boundary under test when assertions require it
- override time explicitly inside tests that exercise date boundaries

## Known Limitations

- The local PHP runtime in this workspace does not have `pdo_sqlite`, so the testing environment was configured around a dedicated MySQL test schema instead of SQLite.
- The dedicated schema `restaurantdb_test` still requires local DB-admin creation/grant if it does not already exist.
- In this workspace run, the smoke database suite could not complete because `menu_user` does not currently have access to `restaurantdb_test`.
- Verified smoke status:
  - `php artisan test tests/Unit/DomainNameTest.php` passed.
  - `php artisan test tests/Feature/TestEnvironmentSmokeTest.php` currently fails at database access until the `restaurantdb_test` grant exists.
- The broader backend suite remains red for business-logic reasons identified in the earlier audit; this environment work does not change those behaviors.
