import { test, expect } from '../setup/qaBrowser';

test('legacy offline upgrade preserves intent and menu data while removing readable guest credentials', async ({ page }) => {
  const raw = `QA_RUN_${process.env.QA_RUN_ID}_legacy_guest_credential`;
  // This guarded JSON document shares the frontend origin without loading app JS.
  await page.goto('/api/__qa/environment');
  await page.evaluate(async (token) => {
    localStorage.setItem('menu_locale', 'en');
    localStorage.setItem('guest_menu_theme', 'dark');
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('menu-react-offline', 1);
      open.onupgradeneeded = () => {
        for (const name of ['guest_menu_cache', 'guest_order_queue', 'waiter_action_queue', 'sync_events_log']) {
          open.result.createObjectStore(name, { keyPath: name === 'guest_menu_cache' ? 'key' : 'id', autoIncrement: name !== 'guest_menu_cache' });
        }
      };
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction(['guest_menu_cache', 'guest_order_queue'], 'readwrite');
        tx.objectStore('guest_order_queue').put({ id: 100, sessionId: 70001, guestAccessToken: token,
          payload: { notes: 'QA_RUN_preserved_intent', items: [{ dish_id: 70002, quantity: 2 }] },
          idempotencyKey: 'QA_RUN_original_request_key', status: 'pending', lastError: null, createdAt: '2026-10-08T12:00:00Z' });
        tx.objectStore('guest_menu_cache').put({ key: `table:70001:token:${token}:lang:en:dishes:all:limit:na:offset:na:index:0`,
          tableId: 70001, language: 'en', updatedAt: Date.now(), payload: { restaurant: { id: 70003, name: 'QA_RUN_preserved_menu', slug: 'qa-run-preserved' },
            dishes: [], table: null, table_session: null, protected_actions: null,
            guest_access: { token, verified: true, joined_at: null, last_seen_at: null, expires_at: null } } });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      open.onerror = () => reject(open.error);
    });
  }, raw);
  await page.goto('/menu');
  await expect(page.locator('#dish-gallery-heading')).toBeVisible();
  const snapshot = async () => page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const open = indexedDB.open('menu-react-offline'); open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
    try {
      const read = (name: string) => new Promise<unknown[]>((resolve, reject) => { const request = db.transaction(name).objectStore(name).getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      return { version: db.version, queued: await read('guest_order_queue'), cached: await read('guest_menu_cache'), language: localStorage.getItem('menu_locale'), theme: localStorage.getItem('guest_menu_theme') };
    } finally { db.close(); }
  });
  await expect.poll(async () => JSON.stringify(await snapshot())).not.toContain(raw);
  const after = await snapshot();
  expect(after.version).toBe(4);
  expect(after.queued).toHaveLength(1);
  expect(after.queued[0]).toMatchObject({ id: 100, sessionId: 70001, idempotencyKey: 'QA_RUN_original_request_key', status: 'pending', payload: { notes: 'QA_RUN_preserved_intent', items: [{ dish_id: 70002, quantity: 2 }] } });
  expect(after.cached).toEqual(expect.arrayContaining([expect.objectContaining({ payload: expect.objectContaining({ restaurant: expect.objectContaining({ name: 'QA_RUN_preserved_menu' }) }) })]));
  expect(after.language).toBe('en');
  expect(after.theme).toBe('dark');
});
