import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

function worker() {
  const listeners = new Map<string, (event: unknown) => void>();
  const records = new Map<string, Map<string, { ok: boolean; clone: () => unknown }>>();
  const self = { location: { origin: 'http://127.0.0.1:9999' }, addEventListener: (name: string, listener: (event: unknown) => void) => listeners.set(name, listener) };
  const caches = {
    keys: async () => [...records.keys()],
    open: async (name: string) => {
      const cache = records.get(name) || new Map(); records.set(name, cache);
      return { match: async (request: { url: string }) => cache.get(request.url), put: async (request: { url: string }, response: unknown) => cache.set(request.url, response) };
    },
  };
  runInNewContext(readFileSync('public/sw.js', 'utf8'), { self, caches, URL, fetch: async () => ({ ok: true, clone: () => ({ private: 'QA_RUN_verified_session' }) }) });
  async function fetchMenu(path: string, headers: Record<string, string> = {}) {
    let handled: Promise<unknown> | undefined;
    listeners.get('fetch')!({ request: { url: self.location.origin + path, method: 'GET', mode: 'cors', headers: { get: (key: string) => headers[key.toLowerCase()] || null } }, respondWith: (promise: Promise<unknown>) => { handled = promise; } });
    if (handled) await handled;
    return { handled: Boolean(handled), records };
  }
  return fetchMenu;
}

describe('shipped service worker privacy boundaries', () => {
  it('does not share table session responses between guest tokens at the same URL', async () => {
    const fetchMenu = worker();
    const result = await fetchMenu('/api/menu/table/1', { 'x-guest-access-token': 'QA_RUN_token_A' });
    expect(result.handled).toBe(false);
    expect([...result.records.values()].flatMap(cache => [...cache.keys()])).toEqual([]);
  });
  it('bypasses authenticated catalog requests while keeping public slug catalogs cacheable', async () => {
    const fetchMenu = worker();
    expect((await fetchMenu('/api/menu/QA_RUN_A/dishes', { authorization: 'Bearer QA_RUN_staff' })).handled).toBe(false);
    expect((await fetchMenu('/api/menu/QA_RUN_A/dishes')).handled).toBe(true);
  });
});
