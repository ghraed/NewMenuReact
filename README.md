# React + TypeScript + Vite

## Isolated live release E2E

`npm run test:e2e` preserves the existing mocked browser coverage. The live
restaurant lifecycle is intentionally separate:

```bash
npm run test:e2e:live
```

The runner holds `/tmp/menu-release-hardening-db.lock`, requires the API
worktree at `/tmp/menu-release-hardening/e2e-api`, accepts only explicit
loopback browser/API URLs, and runs a read-only guard before migration. That
guard requires `APP_ENV=testing`, `APP_URL` on loopback/`testing.local`/`.test`,
and the exact database name `restaurantdb_test`. The runner refuses occupied
ports, verifies both owned process IDs and server responses, then creates
data under a unique `QA_RUN_...` identifier. Its exit trap removes only the
five fixture users and global feature rows created by that identifier; deleting
the fixture owners cascades their two disposable tenants and related records.
Cleanup, residue, owned-process, and port failures make the command fail.

The live spec uses separate guest-mobile, waiter, chef, accountant, and second-
tenant browser contexts. Waiter confirmation, chef start/ready/serve, accountant
draft save, cashier accounting/finalization, and guest bill request use visible
UI controls. It covers lifecycle and cancellation, recipe-backed stock deduction
and restoration, role and tenant isolation, disabled feature API responses and a
disabled direct browser URL, Arabic RTL and English LTR, guest-token revocation,
frontend print rendering, backend PDF download, and exact final database
verification. The product has no visible control to cancel an already confirmed
order, so that one restoration action uses the authenticated backend endpoint and
is reported as a UI NOT IMPLEMENTED gap rather than represented as UI coverage.

Failure traces, screenshots, videos, logs, `test-results/live`, and
`playwright-report-live` are retained for diagnosis. A successful run verifies
zero fixture residue and released ports, then removes all generated artifacts and
temporary server logs.

Dedicated runner/service-worker behavior, WebSocket delivery, concurrent browser
mutations, and queue-worker restart recovery remain NOT IMPLEMENTED/BLOCKED in
this harness; the repository exposes no dedicated runner role or controlled queue
restart fixture, and service workers are deliberately blocked for deterministic
live coverage.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
