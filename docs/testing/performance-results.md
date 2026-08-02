# Performance Results

Date: Sunday, August 2, 2026

## Requested Critical Scenarios

- 50 concurrent menu visitors
- 20 active table sessions
- 10 concurrent order submissions
- simultaneous kitchen updates
- competing reservations for one table
- competing orders consuming one low-stock ingredient

Requested measurements include latency, error rate, database failures, duplicate records, locking, and queue behavior.

## Actual Result

### Static Production Frontend

Command:

`ab -n 200 -c 20 http://127.0.0.1:4175/`

Actual output:

- completed requests: `200`
- failed requests: `0`
- concurrency: `20`
- mean request time: `5.018 ms`
- longest request: `6 ms`
- throughput: `3,985.73 requests/second`
- target: local Vite production preview, static HTML document

ApacheBench warned that the local waiting-time distribution may not be reliable. These local static-file results are not representative of internet, API, database, or production-hosting performance.

### Browser Flow

The Chromium guest-order lifecycle passed against the local production frontend preview. Playwright reported a total suite duration of `2.7s` for one passing scenario and one skipped scenario. This is functional E2E timing, not a load benchmark.

### Backend Concurrency Evidence

The complete backend suite passed `242` tests and `2,907` assertions. Existing tests cover ordinary idempotent order retry, competing reservation conflict policy, and low-stock inventory behavior. These functional tests do not provide sustained-load latency or throughput measurements.

On August 2, the focused command below passed `50` tests and `346` assertions:

`php artisan test --compact --filter='ReservationApiTest|OrderInventoryDeductionTest|OrderWorkflowTest'`

### Seeded Public Menu API Attempt

The isolated `restaurantdb_test` database was rebuilt and seeded with the Alpha/Sigma tenant scenario. The Alpha `qr_menu` feature was enabled only in that test database, and a health request to `GET /api/menu/alpha/dishes` returned `200`.

The following local-only ApacheBench attempts did not produce a usable summary:

- `ab -n 500 -c 50 -H 'Accept: application/json' http://127.0.0.1:8000/api/menu/alpha/dishes`
- `ab -n 100 -c 20 -s 60 -H 'Accept: application/json' http://127.0.0.1:8000/api/menu/alpha/dishes`

The local PHP development server could not complete the seeded large-menu workload in a way that yielded final ApacheBench metrics. No throughput, latency, error-rate, or conclusion is reported from these attempts.

## Not Executed

No valid transactional load test was executed for menu APIs, active table sessions, concurrent order submission, kitchen updates, queues, reservations, or inventory locking.

Reasons:

- no staging backend was provided
- `k6` is not installed
- `artillery` is not installed
- the isolated test database was rebuilt but not seeded for multi-role load traffic

Therefore no API response-time percentile, transactional error rate, database deadlock rate, duplicate-record count under load, or queue-latency metric is reported.

## Required Next Run

Before pilot launch:

- use a dedicated seeded staging environment
- run at least the requested concurrency scenarios with k6 or Artillery
- capture p50, p95, and p99 latency
- capture 4xx/5xx and database failure rates
- verify zero duplicate orders for ordinary retries
- verify one inventory deduction per confirmed order
- verify the documented reservation conflict policy
- capture queue depth, processing latency, and broadcast failures
- preserve database and application logs for post-run integrity checks
