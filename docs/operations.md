# Restaurant Menu operating guide

This guide describes the current implementation after roadmap Tasks 0–10. It does
not certify production infrastructure or authorize deployment or restoring live data.

## Provisioning and sales model

Today restaurant onboarding is controlled by super-admin provisioning and tenant
feature configuration. Staff membership is intentionally single-restaurant; neither
a Host header nor a supplied restaurant ID may switch the authenticated tenant.
The application records restaurant sales, invoices and POS complaint adjustments.
It has no implemented automatic subscription billing, payment-provider subscription
renewal or plan-based billing enforcement. Treat commercial agreements and billing
as external/manual operations until the owner defines prices, plans, entitlement
changes, grace periods, cancellation and recovery. Task 10 adds no billing feature.
The intended future commercial model remains an owner decision; current behavior
must not be described as an implemented subscription service.

Inactive restaurants may show menus, allow permitted login/reads and finish
existing work; new sessions, orders, POS sales and reservations are rejected with
`restaurant_inactive`. Pending work can retain/reduce existing quantities, not add
commerce. Super-admin recovery and reactivation retain their existing controls.
See the [approved lifecycle matrix](testing/task-5-2026-10-07/policy-review.txt).

## Roles, flags and routes

The API is authoritative; a visible route alone does not grant access. Flags are
independent and tenant-scoped. For a missing page check permissions, route registration,
seed data, flags, active state and environment before filing a defect. Current API
route definitions in `Menu_API/routes/api.php` remain the exact source of truth.

| Flow | Roles / identity | Required configuration |
| --- | --- | --- |
| Public catalog | Public guest; slug/host resolves tenant | Published dishes; table-sensitive responses must bypass shared caches |
| Table ordering | Valid active session/PIN guest; authorized staff/admin paths | `table_ordering`, assigned table/session; active restaurant for new commerce |
| Staff and kitchen | Admin/staff; chef on kitchen routes | `realtime_staff_orders` where applied, existing assignments and kitchen policy |
| POS | Admin/staff (accountant retains existing POS denial) | `table_ordering`; capability response controls compensation UI; server approval rules retained |
| POS reports and adjustment approvals | Admin/accountant/staff reports; authorized admin/accountant approval | `table_ordering`; finalized facts only, with currencies and report timezone kept separate |
| Finance and private PDF | Admin/accountant | `finance_dashboard`, `vat_invoices`, `expense_management` where routes require them |
| Room plan | Admin/staff write; chef/stock manager permitted reads | `room_plan_editor`; numeric position controls use the same bounds/window snapping as dragging |
| Reservations | Public guest / permitted admin/staff paths | `table_reservations`, valid room plan/table; active tenant for new bookings |
| Events | Admin/chef/stock manager on registered event routes | `event_reservations`; related menu/forecast configuration |
| Payroll/scheduling | Existing authorized administration roles | Respective payroll/scheduling flags; no permission expansion |
| Optional AI, 3D, push, custom host | Existing per-feature roles | Explicit feature enablement and runtime service config; off in ordinary QA fixtures |

Compensation reports distinguish waived revenue, refunds and gift catalog value;
gift catalog value is not inventory cost. Draft local audit activity is excluded
from financial totals. Historical stored audit messages and restaurant-supplied names
remain their recorded text; translating controls does not rewrite them.

## Repeatable test data and browser matrix

Use the paired disposable runner documented in `Menu_API/scripts/qa/README.md`.
Every run has a unique ID, fresh owned MySQL data directory, synthetic `QA_RUN_*`
restaurants/users/items, isolated storage and disabled external transport credentials.
Each browser case resets its fixture schema/cache. Never reuse real customer records
or run migration/reset commands against `restaurantdb`. Scenario hashes give mobile,
Firefox and WebKit distinct accounts. The runner never reuses the development server.

The default browser run includes desktop Google Chrome/mobile Chrome emulation and the real
service-worker-enabled offline project. `--browser-matrix` additionally requires the
pinned Playwright Firefox/WebKit runtimes. Use `npx playwright install --with-deps
firefox webkit` from the frontend first. For custom disposable browser storage, set
`PLAYWRIGHT_BROWSERS_PATH` when installing and running with `--browser-matrix`.
A missing engine is BLOCKED/FAIL, never silently skipped. CI installs these engines
and requests the matrix. Local green checks do not prove hosted CI passed.

Task 10 covers Arabic/RTL POS checkout/reporting with independently expected $0 paid
and $10 waived, both themes, login errors, keyboard modal dismissal/focus restoration,
solid-surface contrast, room-plan coordinate persistence and bilingual print media.
Print fixtures derive receipt values from a real paid POS snapshot; this tests the
print renderer, while earlier tests retain storage/authorization/financial coverage.
Browser print emulation does not verify a physical printer or OS print dialog.

## Performance budgets and assets

The built-asset measurement uses 390×844 viewport, 4× CPU slowdown, 150 ms latency,
200,000 bytes/s download, 93,750 bytes/s upload and disabled browser HTTP cache.
Twelve published synthetic catalog dishes are seeded, with three cold samples per
route. Guest catalog, login, POS and finance use real QA HTTP. Reported JS
bytes are `encodedBodySize` for observed scripts; timings are synthetic local
measurements, not field percentiles or physical-device certification. LCP is sampled
500 ms after the ready locator; `readyMs` includes this fixed observer window. Public readiness is the first synthetic dish heading/login field;
POS readiness is the finalized report heading, finance readiness the finance heading.

| Route | Observed script-byte ceiling | Ready ceiling | Sampled LCP ceiling |
| --- | ---: | ---: | ---: |
| `/menu`, `/admin/login` | 300,000 | 7,000 ms | 5,000 ms |
| `/staff/pos` | 400,000 | 9,000 ms | 7,000 ms |
| `/admin/finance` | 450,000 | 9,000 ms | 7,000 ms |

Budgets live in `tests/fixtures/performance-budgets.json` and are asserted by the real
browser case. Review regressions against measurements rather than raising ceilings.
The original 1,200 kB per-chunk warning limit is unchanged. Large optional 3D,
spreadsheet and PDF chunks still exist; they no longer belong to every guest load.
Admin pages are lazy routes; charts load with finance, export libraries with export,
and a thumbnail viewer only when a GLB thumbnail is actually needed.

Publish a complete built artifact atomically. Serve history/deep-link paths with
`index.html` fallback, but missing `/assets/*.js` with a real 404, not HTML. Keep
previous content-hashed assets during the supported open-tab/worker lifetime and
rollback window; an old document can still request an old lazy chunk. Serve HTML
and `sw.js` with revalidation, immutable hashed assets with long cache lifetimes.
A chunk load failure must prompt refresh; do not clear tenant/offline storage.
Task 9's worker cache and durable request identity remain unchanged. Built preview
checks deep-link/reload and real spreadsheet download; a real deployment/CDN rollout
still requires separately authorized infrastructure verification.

## Runtime and release prerequisites

Keep Node >=22.12, Composer locks and PHP extensions compatible with the tested
runtime. The Task 6 PHP/Apache image packages Chromium and Noto Arabic fonts; private
storage and browser temporary/XDG paths must be writable by `www-data`. External
services need explicit runtime configuration. Never bake APP_KEY, credentials, env
files or Laravel cached config into an image. Supply the existing APP_KEY and DB
settings to app, worker, scheduler and realtime services; preserve persistent storage.
See `Menu_API/scripts/qa/README.md` for actual container commands and release probes.

Required gates include full API/unit/browser matrix, lint/TypeScript/builds, Pint,
Composer validation, audits and tooling, fresh disposable migrations, actual queue/
scheduler/realtime/host checks and backup restore. A build cannot prove ordering;
a browser cannot prove all server authorization. Rebuild and separately verify the
release image with the final paired locks/sources before deployment. Hosted CI,
public TLS/DNS delivery, load capacity and physical printers need their own evidence.

Deploy Task 9's additive migration and durable API fleet under a guest-write drain
before frontend/worker v5. Task 10 introduces no migration, API contract, invoice
rewrite or worker version change; its frontend can follow the existing Task 9 API.

## Monitoring, restore and rollback

Monitor application error/status rates (including route/chunk load failures), API
latency, MySQL lock waits/deadlocks, queue lag and failed jobs, scheduler heartbeat,
Reverb disconnects/poll fallback, private PDF failures, disk space and backup age.
Track guest replay conflicts/review states, denied tenant access and financial
report reconciliation by currency; do not log passwords, tokens or customer payloads.
Attach branch/commit/artifact digest and sanitized request IDs to investigations.
No monitoring provider, alert thresholds or production SLA is inferred here.

Before release retain current/previous tested artifact digests and their matched
runtime configuration. Run the disposable `--launch` migration and restore rehearsal:
quiesce owned writers, back up its synthetic DB plus private/public storage, compare
all table/file fingerprints, rehearse named migrations, restore, verify runtime-key
decryption, finalization/request identities, paid receipt/finance and host routing.
Raw backups and runtime keys stay in the owned runtime and are deleted on cleanup.
A production restore requires an authorized maintenance window, a matching verified
backup and a separately verified infrastructure procedure.

Rollback Task 10 by restoring the previous complete frontend assets and reverting
only its UI/lazy-loading/config/documentation changes. Keep Tasks 0–9 fixes, durable
request rows, schema, settled orders and APP_KEY. Never drop replay/finalization data
or use an old cache-only API as a shortcut. Keep compatible old hashed chunks until
old documents are retired. Native dialog and numeric positioning changes have no
data migration. Infrastructure/fleet rollback remains unexecuted by this task.

## Legacy hardening integration (9 October 2026)

The [integration record](testing/legacy-branch-integration-2026-10-09.txt) describes
cookie authentication, private dish assets, durable staff retries and alert outboxes.
Deploy the reviewed API/frontend pair together through the release gates above.
Apply the additive migrations before exposing new endpoints and drain guest writes
for the transition. Keep both old and canonical guest idempotency records.

Browser credentials now use HttpOnly cookies on `/api`, with Secure outside local/
testing and SameSite Strict. Frontend/API should share an HTTPS origin through the
existing `/api` proxy. Explicit trusted CORS origins are required for supported
same-site development; arbitrary cross-site hosting will not carry these cookies.
Keep bearer mode for supported non-browser clients; browser session revisions,
expected account IDs and guest cache hashes are metadata, not credentials.

Persist and grant the API runtime access to `storage/app/dish-assets`. New dish
assets use the private `dish_assets` disk; authorized reads use `/api/assets`.
Rehearse `php artisan dish-assets:migrate-to-protected --dry-run` and migration
against disposable synthetic assets first. Verify protected bytes, metadata and
retry recovery before any separately approved live run. Web-server denial of
`/storage/dishes` and removal of public test routes are part of the boundary.

Run the existing scheduler and queue/realtime workers. The scheduler retries the
order alert outbox with `orders:deliver-pending-alerts`; monitor pending rows,
attempts, delivery errors and recipient retry state. Replay still checks current
permissions and table assignment before returning cached staff mutation responses.

IndexedDB upgrades retain queued payloads and request keys, migrate readable guest
credentials to opaque scope, and quarantine caches with unknown ownership. Older
open app tabs may need closing to allow the schema upgrade. Do not clear browser
storage or delete queued work to resolve deployment issues. Preserve old static
chunks until offline clients can update. Rollback must support private asset paths,
issued cookies and all durable request/outbox records; retain backups and rehearse
the paired rollback on disposable infrastructure.
