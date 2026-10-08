# Restaurant Menu frontend

React 19 / TypeScript / Vite frontend for the sibling Laravel `Menu_API`. Guest
catalog, table PIN ordering, staff/kitchen/POS, accounting and restaurant
administration share the tenant-scoped API. Arabic and English, RTL and light/dark
modes are supported. Backend permissions, prices, settlement and stock are authoritative.

## Setup and disposable verification

Use Node >=22.12 and the committed dependency locks. Run `npm ci` here; install
Composer and npm dependencies in `Menu_API` as described in its
[QA setup](../Menu_API/scripts/qa/README.md). Do not use `composer setup`, the normal
restaurant database or production Compose configuration for automated testing.

```sh
# From Menu_React: install the pinned additional browser runtimes.
npx playwright install --with-deps firefox webkit
# From Menu_API: replace the example ID and evidence directory for each run.
python3 scripts/qa/run.py --launch --browser-matrix --react-root ../Menu_React --run-id task10_example --evidence /tmp/menu-task10-example
```

The paired runner verifies branch/commit, loopback URLs, `APP_ENV=testing`, new
`menu_test_QA_RUN_*` MySQL schemas and safe transports before migrations. It builds
this frontend against only its API, records flags and synthetic users, tests actual
scripts and cleans its owned processes/database/storage. Direct browser tests fail
closed without that environment. Frontend scripts are `npm run lint`,
`npm run test:unit`, `npm run build`, `npm run dev`, `npm run preview` and
`npm run test:e2e`. The full runner also checks API tests, assets, audits, formatting,
realtime, queues, scheduler and backup restore. No skipped test satisfies a gate.

For UI development, run `npm run dev` only after explicitly verifying
`VITE_PROXY_TARGET` points to your isolated development API. For a built preview use
`npm run build -- --mode qa` and `npm run preview -- --mode qa`. Preview alone does
not seed data or verify the API. Keep runtime credentials outside this repository.

## Product operations and release

See the [operating guide](docs/operations.md) for feature/role combinations,
subscription/provisioning behavior, test data, runtime prerequisites, performance
budgets, asset deployment, monitoring, restore and rollback. Previous task reports
and [fix progress](docs/testing/fix-progress.txt) retain the financial/isolation and
offline compatibility constraints. This document does not authorize deployment.
