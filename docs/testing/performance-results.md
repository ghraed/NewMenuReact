# Performance Results

Date: Wednesday, July 29, 2026

## Requested Minimum Scenarios

Requested:
- 50 concurrent menu visitors
- 20 active table sessions
- 10 concurrent order submissions
- simultaneous kitchen updates
- two reservations for the same table
- two orders consuming the same low-stock ingredient

Required measurements:
- response time
- error rate
- database failures
- duplicate records
- locking behavior
- queue behavior

## What Was Actually Executed

Executed on Wednesday, July 29, 2026:
- checked local tooling availability with `which k6`
- checked local tooling availability with `which artillery`
- attempted browser E2E setup with local Vite server and Playwright

Observed:
- `k6` not installed
- `artillery` not installed
- Playwright Chromium could not launch in this environment, so browser-driven load simulation was not possible

## Result

No valid performance run was executed on Wednesday, July 29, 2026.

No response-time, error-rate, locking, queue, or duplicate-record metrics are reported here because that data was not safely or successfully collected.

## Why Performance Was Blocked

Blocking conditions:
- no safe staging or dedicated test backend target was provided for concurrent order/reservation load
- `k6` and `artillery` are not installed in this environment
- local browser automation is blocked by Chromium sandbox failure:
  - `sandbox_host_linux.cc:41`
  - `shutdown: Operation not permitted (1)`

## Related Evidence From Existing Repository Reviews

Although no new load test was run today, earlier repository reviews already document relevant backend behavior:
- `docs/testing/inventory-integrity-review.md`
  - inventory deduction idempotency exists
  - ingredient row locking and rollback behavior were previously verified in backend tests
  - competing low-stock ingredient consumption was previously tested at backend level

This is not a substitute for the requested performance run. It only indicates some concurrency protections already exist in code and prior backend tests.

## Minimum Next Step To Produce Real Results

To produce real performance numbers, rerun on a staging or dedicated test environment with seeded data and one of these options:

Option A:
- install `k6`
- run HTTP scenarios for guest menu, table sessions, order submit, confirm, invoice, and reservation conflict

Option B:
- install `artillery`
- run authenticated multi-role flows plus guest traffic against staging APIs

Before running:
- use test or staging only
- seed at least two restaurants and low-stock ingredients
- enable log capture for API errors, DB deadlocks, and duplicate order/invoice creation
