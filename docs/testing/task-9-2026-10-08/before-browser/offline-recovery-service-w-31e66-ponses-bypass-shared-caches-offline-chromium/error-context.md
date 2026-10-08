# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: offline-recovery.spec.ts >> service worker keeps public offline menu while token-sensitive responses bypass shared caches
- Location: tests/e2e/offline-recovery.spec.ts:44:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 6

- Array []
+ Array [
+   "http://127.0.0.1:44121/api/menu/table/1?include_dishes=none",
+   "http://127.0.0.1:44121/api/menu/table/1?include_dishes=page&limit=20&offset=0&include_index=1",
+   "http://127.0.0.1:44121/api/menu/table/1?include_dishes=all&include_index=1",
+   "http://127.0.0.1:44121/api/menu/table/1",
+ ]
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - 'button "Language: EN" [pressed] [ref=e5] [cursor=pointer]': EN
    - 'button "Language: AR" [ref=e6] [cursor=pointer]': AR
  - button "Switch to dark theme" [ref=e7] [cursor=pointer]:
    - img [ref=e9]
  - generic [ref=e13]:
    - main [ref=e15]:
      - generic [ref=e16]:
        - generic [ref=e18]: Q
        - heading "QA_RUN_task9_offline_before_20261008_02_1da54512d9_restaurant" [level=2] [ref=e20]
      - generic [ref=e22]:
        - generic [ref=e23]:
          - generic [ref=e24]:
            - paragraph [ref=e25]: Ordering Unlocked
            - heading "Protected actions are ready" [level=2] [ref=e26]
            - paragraph [ref=e27]: This device is verified for T01. Orders, waiter calls, and bill requests now use the active table session securely.
          - generic [ref=e28]: T01
        - generic [ref=e29]:
          - paragraph [ref=e30]: Ordering unlocked for this table.
          - paragraph [ref=e31]: Protected actions stay available until staff reset or finalize the table.
          - link "View Orders" [ref=e33] [cursor=pointer]:
            - /url: /menu/table/1/orders
      - generic [ref=e34]:
        - generic [ref=e35]:
          - paragraph [ref=e36]: QA_RUN_task9_offline_before_20261008_02_1da54512d9_restaurant
          - heading "Review Your Order" [level=1] [ref=e37]
        - link "Back to menu" [ref=e39] [cursor=pointer]:
          - /url: /menu/table/1
      - generic [ref=e40]:
        - generic [ref=e41]:
          - generic [ref=e42]:
            - generic [ref=e43]:
              - paragraph [ref=e44]: Cart
              - heading "1 item" [level=2] [ref=e45]
            - generic [ref=e46]: $12.50
          - article [ref=e48]:
            - generic [ref=e49]:
              - generic [ref=e50]:
                - heading "QA_RUN_task9_offline_before_20261008_02_1da54512d9_Grill" [level=3] [ref=e51]
                - paragraph [ref=e52]: Aut ullam dicta rerum eaque nobis.
              - button "Remove" [ref=e53] [cursor=pointer]
            - generic [ref=e54]:
              - generic [ref=e55]:
                - button "-" [ref=e56] [cursor=pointer]
                - generic [ref=e57]: "1"
                - button "+" [ref=e58] [cursor=pointer]
              - generic [ref=e59]:
                - paragraph [ref=e60]: $12.50 each
                - paragraph [ref=e61]: $12.50
        - generic [ref=e62]:
          - paragraph [ref=e63]: Table Request
          - heading "Send this order to staff" [level=2] [ref=e64]
          - paragraph [ref=e65]: Your table is detected automatically from the QR code session. Staff will confirm or cancel the request before it reaches accounting.
          - generic [ref=e66]:
            - generic [ref=e67]:
              - paragraph [ref=e68]: Table reference
              - paragraph [ref=e69]: T01
            - generic [ref=e70]:
              - generic [ref=e71]: Notes for the team
              - textbox "Notes for the team" [ref=e72]:
                - /placeholder: Optional service note for the staff...
            - button "Send Order Request" [ref=e73] [cursor=pointer]
      - generic [ref=e74]:
        - generic [ref=e75]:
          - paragraph [ref=e76]: Guest Information
          - heading "Service notes for your table" [level=2] [ref=e77]
        - article [ref=e79]:
          - paragraph [ref=e80]: Pairing Notes
          - heading "Guest Guidance" [level=3] [ref=e81]
          - generic [ref=e82]:
            - paragraph [ref=e84]: Please share allergy or dietary requests before selecting a dish detail page.
            - paragraph [ref=e86]: Ask the team for seasonal pairings, tasting order suggestions, and lighter alternatives.
    - button "Wave Staff" [ref=e87] [cursor=pointer]:
      - generic [ref=e88]: 👋
    - generic [ref=e89]:
      - generic:
        - generic:
          - button "Open BootChat":
            - img
          - button "Request Bill":
            - img
          - button "1 item in cart":
            - img
            - generic: "1"
      - button "Open quick actions" [ref=e90] [cursor=pointer]:
        - generic [ref=e91]: +
        - generic [ref=e92]: "1"
```

# Test source

```ts
  1   | import { execFileSync } from 'node:child_process';
  2   | import { resolve } from 'node:path';
  3   | import type { Page, APIRequestContext } from '@playwright/test';
  4   | import { test, expect } from '../setup/qaBrowser';
  5   |
  6   | function fixture(action = 'create') {
  7   |   return JSON.parse(execFileSync('php', [resolve('tests/setup/offlineFixtures.php'), action], { env: process.env, encoding: 'utf8' }));
  8   | }
  9   | async function queue(page: Page) {
  10  |   return page.evaluate(async () => {
  11  |     const db = await new Promise<IDBDatabase>((resolve, reject) => {
  12  |       const request = indexedDB.open('menu-react-offline');
  13  |       request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  14  |     });
  15  |     try {
  16  |       return await new Promise<Array<{ id: number; status: string; idempotencyKey: string }>>(resolve => {
  17  |         if (!db.objectStoreNames.contains('guest_order_queue')) { resolve([]); return; }
  18  |         const request = db.transaction('guest_order_queue').objectStore('guest_order_queue').getAll();
  19  |         request.onsuccess = () => resolve(request.result);
  20  |       });
  21  |     } finally { db.close(); }
  22  |   });
  23  | }
  24  | async function enter(page: Page, request: APIRequestContext) {
  25  |   const data = fixture();
  26  |   const auth = await request.post('/api/auth/login', { data: { email: process.env.PLAYWRIGHT_PROFILE_EMAIL, password: process.env.PLAYWRIGHT_PROFILE_PASSWORD } });
  27  |   expect(auth.status()).toBe(200);
  28  |   const activated = await request.post('/api/table-sessions/activate', { headers: { Authorization: `Bearer ${(await auth.json()).token}` }, data: { table_id: data.a.tableId } });
  29  |   expect(activated.status()).toBe(200);
  30  |   await page.goto('/menu/table/1');
  31  |   await page.evaluate(async () => { await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready; });
  32  |   await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  33  |   await page.reload();
  34  |   await page.getByPlaceholder('0000').fill((await activated.json()).current_pin);
  35  |   await page.getByRole('button', { name: 'Unlock Ordering' }).click();
  36  |   await expect(page.getByText('Protected actions are ready')).toBeVisible();
  37  |   await page.getByRole('button', { name: 'Add to Cart', exact: true }).first().click();
  38  |   await page.getByRole('link', { name: /items? in cart/i }).click();
  39  |   await expect(page.getByRole('heading', { name: 'Review Your Order' })).toBeVisible();
  40  |   await expect(page.getByRole('button', { name: 'Send Order Request' })).toBeEnabled();
  41  |   return data;
  42  | }
  43  |
  44  | test('service worker keeps public offline menu while token-sensitive responses bypass shared caches', async ({ page, context, request }) => {
  45  |   await enter(page, request);
  46  |   // Same URL, different identity. CacheStorage does not partition custom headers by default.
  47  |   const response = await page.evaluate(async () => {
  48  |     const r = await fetch('/api/menu/table/1', { headers: { 'X-Guest-Access-Token': 'QA_RUN_invalid' } });
  49  |     return r.status;
  50  |   });
  51  |   expect(response).toBe(200);
  52  |   const protectedEntries = await page.evaluate(async () => {
  53  |     const found: string[] = [];
  54  |     for (const name of await caches.keys()) {
  55  |       for (const request of await (await caches.open(name)).keys()) {
  56  |         if (new URL(request.url).pathname.startsWith('/api/menu/table/')) found.push(request.url);
  57  |       }
  58  |     }
  59  |     return found;
  60  |   });
> 61  |   expect(protectedEntries).toEqual([]);
      |                            ^ Error: expect(received).toEqual(expected) // deep equality
  62  |   await page.goto('/menu/table/1');
  63  |   await expect(page.getByRole('button', { name: 'Add to Cart', exact: true }).first()).toBeVisible();
  64  |   await context.setOffline(true);
  65  |   await page.reload();
  66  |   await expect(page.getByRole('button', { name: 'Add to Cart', exact: true }).first()).toBeVisible();
  67  |   expect(fixture('snapshot').orders).toHaveLength(0);
  68  | });
  69  |
  70  | test('lost acknowledgement survives reload, application upgrade and competing tabs with one server order', async ({ page, context, request }) => {
  71  |   await enter(page, request);
  72  |   let committed = false;
  73  |   await context.route('**/api/table-session/*/order', async route => {
  74  |     if (!committed && route.request().method() === 'POST') {
  75  |       const response = await route.fetch();
  76  |       expect(response.status()).toBe(201); committed = true;
  77  |       await route.abort('connectionreset');
  78  |     } else await route.continue();
  79  |   });
  80  |   await page.getByRole('button', { name: 'Send Order Request' }).click();
  81  |   await expect.poll(() => committed).toBe(true);
  82  |   await expect.poll(async () => (await queue(page)).length).toBe(1);
  83  |   const key = (await queue(page))[0].idempotencyKey;
  84  |   expect(fixture('snapshot').orders).toHaveLength(1);
  85  |   await context.setOffline(true);
  86  |   await page.reload();
  87  |   expect((await queue(page))[0].idempotencyKey).toBe(key);
  88  |   // Run the real shipped activation lifecycle with obsolete caches present.
  89  |   await context.setOffline(false);
  90  |   await page.evaluate(async () => {
  91  |     await caches.open('guest-api-v3');
  92  |     const registration = await navigator.serviceWorker.getRegistration();
  93  |     await registration?.unregister();
  94  |     await navigator.serviceWorker.register('/sw.js?QA_RUN_upgrade=1');
  95  |     await navigator.serviceWorker.ready;
  96  |   });
  97  |   await expect.poll(() => page.evaluate(async () => (await caches.keys()).includes('guest-api-v3'))).toBe(false);
  98  |   await context.unroute('**/api/table-session/*/order');
  99  |   const second = await context.newPage();
  100 |   await second.goto(page.url());
  101 |   const buttons = [page, second].map(p => p.getByRole('button', { name: 'Confirm this order now', exact: true }));
  102 |   await expect(buttons[0]).toBeVisible(); await expect(buttons[1]).toBeVisible();
  103 |   await Promise.all(buttons.map(button => button.click()));
  104 |   await expect.poll(async () => (await queue(page)).length).toBe(0);
  105 |   const snapshot = fixture('snapshot');
  106 |   expect(snapshot.orders).toHaveLength(1); expect(snapshot.orders[0].total).toBe('12.50');
  107 |   expect(snapshot.foreign_orders).toBe(0);
  108 |   await second.close();
  109 | });
  110 |
  111 | for (const invalidation of ['expire', 'close']) {
  112 |   test(`offline interrupted submit requires review after session ${invalidation}`, async ({ page, context, request }) => {
  113 |     await enter(page, request);
  114 |     await context.setOffline(true);
  115 |     await page.getByRole('button', { name: 'Send Order Request' }).click();
  116 |     await expect.poll(async () => (await queue(page)).length).toBe(1);
  117 |     const key = (await queue(page))[0].idempotencyKey;
  118 |     expect(fixture(invalidation).orders).toHaveLength(0);
  119 |     await page.reload();
  120 |     await context.setOffline(false);
  121 |     await page.getByRole('button', { name: 'Confirm this order now', exact: true }).click();
  122 |     await expect.poll(async () => (await queue(page))[0]?.status).toBe('needs_review');
  123 |     expect((await queue(page))[0].idempotencyKey).toBe(key);
  124 |     expect(fixture('snapshot').orders).toHaveLength(0);
  125 |   });
  126 | }
  127 |
```
