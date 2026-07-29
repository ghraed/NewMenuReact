# Security Review

Date: Wednesday, July 29, 2026

Reviewed codebases:
- `/media/raed/Data/from ubuntu/new_menu/Menu_React`
- `/media/raed/Data/from ubuntu/new_menu/Menu_API`

## Executed Inputs

Reviewed on Wednesday, July 29, 2026 using:
- existing audit docs in `docs/testing/*.md`
- `src/services/api.ts`
- `src/components/Auth/ProtectedRoute.tsx`
- `src/contexts/AuthContext.tsx`
- `../Menu_API/routes/api.php`
- `../Menu_API/routes/channels.php`
- `../Menu_API/app/Http/Controllers/AuthController.php`
- `../Menu_API/config/sanctum.php`
- targeted `rg` searches for authz, tenant scoping, raw SQL, uploads, CORS, rate limits, and websocket authorization

## Current Findings

### 1. Personal access tokens do not expire

Status:
- active risk

Evidence:
- `../Menu_API/config/sanctum.php` sets `'expiration' => null`

Impact:
- stolen bearer tokens remain valid until explicit revocation
- increases risk for lost devices, copied tokens, and long-lived session leakage

Priority:
- high

### 2. No disabled-user enforcement for restaurant users

Status:
- active risk carried from prior auth review

Evidence:
- prior reviewed auth document states no disabled user state is enforced for restaurant users
- `AuthController@login` validates credentials and tenant membership, but no disabled/suspended check is visible in the current login path

Impact:
- operationally disabled staff cannot be reliably blocked at authentication time

Priority:
- high

### 3. Browser E2E authorization matrix remains unverified on July 29, 2026

Status:
- review gap

Evidence:
- Playwright Chromium failed before app execution in this environment
- route guards and backend middleware look present, but the requested runtime proof for cross-role and cross-tenant journeys was not executable here

Impact:
- tenant isolation and role blocking are structurally reviewed, not freshly runtime-proven in browser for this run

Priority:
- high until rerun in browser-capable CI/staging

## Previously Confirmed And Still Relevant

From prior repository audits already present in this repo:
- brute-force throttling for `POST /api/auth/login` was added and should remain required
- direct asset-file IDOR was fixed by signed access and same-tenant checks
- websocket channel authorization in `routes/channels.php` is tenant-scoped by restaurant id and role
- inventory deduction idempotency and row-locking protections were verified in backend tests

## Checks With No New Defect Confirmed In This Run

The following areas were inspected but no new concrete defect was confirmed from local code review on Wednesday, July 29, 2026:
- broken access control in visible route middleware layout
- websocket authorization bypass in visible broadcast channel definitions
- obvious SQL injection in reviewed auth/routing paths
- obvious frontend XSS sinks in reviewed auth and guest-routing code
- client cross-origin API leakage from the frontend:
  - `src/services/api.ts` intentionally forces same-origin `/api` outside local loopback, which is the correct direction for host-based tenant resolution

## Areas Still Not Fully Verified In Runtime

These remain unverified or only partially verified in this workspace:
- CSRF behavior for any cookie-authenticated or stateful endpoints
- CORS policy, because no local `config/cors.php` surface was present to confirm the effective runtime policy from this workspace alone
- mass assignment coverage across all controllers and models
- insecure file upload validation across all upload endpoints
- public storage exposure outside the previously fixed asset case
- sensitive logging and debug-mode exposure in deployed environment
- rate limits outside the explicitly reviewed auth/chat entry points
- reservation race handling and same-table double booking under true concurrent runtime load
- client-controlled prices under a full browser-to-backend checkout run

## Requested Checklist Mapping

Broken access control:
- partially reviewed
- no new defect confirmed in this run
- runtime browser proof still missing

SQL injection risks:
- no new defect confirmed in reviewed paths
- broader controller/model audit still incomplete

XSS:
- no new defect confirmed in reviewed frontend auth and route-guard surfaces

CSRF:
- not fully verified

Mass assignment:
- not fully verified

Insecure file uploads:
- not fully verified

Path traversal:
- no new defect confirmed in reviewed paths
- prior asset file exposure had already been addressed

Exposed secrets:
- not confirmed in this workspace pass

Debug mode:
- not runtime-verified

Unsafe CORS:
- not confirmed; effective runtime config not fully observable here

Sensitive logging:
- not fully verified

Missing rate limits:
- still a concern outside login/chat routes unless audited endpoint-by-endpoint

Public storage exposure:
- prior asset IDOR was fixed
- broader public file surface still needs endpoint-by-endpoint validation

Unsafe WebSocket authorization:
- no new defect confirmed; current channel callbacks are tenant-aware

Client-controlled prices:
- not runtime-verified in this pass

## Recommended Actions

1. Enable Sanctum token expiration and pair it with forced re-auth / token rotation.
2. Add explicit disabled or suspended user enforcement in login and protected-user refresh flows.
3. Rerun the requested cross-tenant and restricted-feature browser journeys in a browser-capable CI or staging environment.
4. Audit upload controllers, model fillable/guarded settings, and effective CORS config endpoint-by-endpoint.
