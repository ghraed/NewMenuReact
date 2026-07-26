# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: guest-order-lifecycle.spec.ts >> Guest order lifecycle >> guest unlocks a table, reviews the cart, submits an order, and sees the progressed order state
- Location: tests/e2e/guest-order-lifecycle.spec.ts:4:3

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /2 items in cart/i })
    - locator resolved to <button type="button" aria-label="2 items in cart" class="relative inline-flex h-12 w-12 items-center justify-center rounded-xl border transition duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60">…</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <div class="pointer-events-auto flex flex-col items-center gap-2 sm:items-end">…</div> intercepts pointer events
  - retrying click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <div class="relative z-10">…</div> intercepts pointer events
  - retrying click action
    - waiting 20ms
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <div class="pointer-events-auto flex flex-col items-center gap-2 sm:items-end">…</div> intercepts pointer events
  2 × retrying click action
      - waiting 100ms
      - waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <span class="inline-block transition-transform duration-300">+</span> from <button type="button" aria-label="Open quick actions" class="relative z-10 inline-flex h-14 w-14 items-center justify-center rounded-full border text-2xl font-semibold transition duration-300 hover:-translate-y-0.5 hover:scale-105">…</button> subtree intercepts pointer events
  27 × retrying click action
       - waiting 500ms
       - waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <div class="relative z-10">…</div> intercepts pointer events
     - retrying click action
       - waiting 500ms
       - waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <div class="pointer-events-auto flex flex-col items-center gap-2 sm:items-end">…</div> intercepts pointer events
     - retrying click action
       - waiting 500ms
       - waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <span class="inline-block transition-transform duration-300">+</span> from <button type="button" aria-label="Open quick actions" class="relative z-10 inline-flex h-14 w-14 items-center justify-center rounded-full border text-2xl font-semibold transition duration-300 hover:-translate-y-0.5 hover:scale-105">…</button> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms
       - waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <span class="inline-block transition-transform duration-300">+</span> from <button type="button" aria-label="Open quick actions" class="relative z-10 inline-flex h-14 w-14 items-center justify-center rounded-full border text-2xl font-semibold transition duration-300 hover:-translate-y-0.5 hover:scale-105">…</button> subtree intercepts pointer events
  - retrying click action
    - waiting 500ms
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <div class="relative z-10">…</div> intercepts pointer events
  - retrying click action
    - waiting 500ms

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
        - generic [ref=e18]: C
        - generic [ref=e19]:
          - heading "Cedar Flame" [level=2] [ref=e20]
          - paragraph [ref=e21]: Levantine grill and mezze kitchen.
      - generic [ref=e23]:
        - generic [ref=e24]:
          - generic [ref=e25]:
            - paragraph [ref=e26]: Ordering Unlocked
            - heading "Protected actions are ready" [level=2] [ref=e27]
            - paragraph [ref=e28]: This device is verified for T01. Orders, waiter calls, and bill requests now use the active table session securely.
          - generic [ref=e29]: T01
        - generic [ref=e30]:
          - paragraph [ref=e31]: Ordering unlocked for this table.
          - paragraph [ref=e32]: Protected actions stay available until staff reset or finalize the table.
          - link "View Orders" [ref=e34] [cursor=pointer]:
            - /url: /menu/table/1/orders
      - region "Explore every dish with its own details page" [ref=e35]:
        - generic [ref=e36]:
          - generic [ref=e37]:
            - paragraph [ref=e38]: Dish Gallery
            - heading "Explore every dish with its own details page" [level=1] [ref=e39]
          - generic [ref=e41]: 1 dish
        - generic [ref=e43]:
          - generic [ref=e44]:
            - text: Search
            - generic [ref=e45]:
              - generic: ⌕
              - textbox "Search ⌕" [ref=e46]:
                - /placeholder: Search dishes...
          - generic [ref=e47]:
            - text: Filter by ingredients
            - button "Choose ingredients to show Search ingredients, then show, hide, or mark matching dishes red ▾" [ref=e48] [cursor=pointer]:
              - generic [ref=e49]:
                - paragraph [ref=e50]: Choose ingredients to show
                - paragraph [ref=e51]: Search ingredients, then show, hide, or mark matching dishes red
              - generic [ref=e52]: ▾
          - generic [ref=e53]:
            - paragraph [ref=e54]: Filter by category
            - generic [ref=e55]:
              - button "All" [ref=e56] [cursor=pointer]
              - button "Main Courses" [ref=e57] [cursor=pointer]
        - generic [ref=e58]:
          - generic [ref=e59]:
            - generic [ref=e60]: Featured
            - generic [ref=e61]: 1 featured dish
          - button "🍽 Chef's Recommendation Mixed Grill Plate Show USD equivalent Charcoal chicken, kafta, and lamb. Main Courses Spicy Main Course Decrease quantity 2 Increase quantity View Details" [ref=e63] [cursor=pointer]:
            - generic [ref=e64]:
              - generic [ref=e66]: 🍽
              - generic [ref=e67]:
                - generic [ref=e69]: Chef's Recommendation
                - generic [ref=e70]:
                  - generic [ref=e71]:
                    - heading "Mixed Grill Plate" [level=3] [ref=e72]
                    - button "Show USD equivalent" [ref=e74]: $12.50
                  - paragraph [ref=e75]: Charcoal chicken, kafta, and lamb.
                  - generic [ref=e76]:
                    - generic [ref=e77]: Main Courses
                    - generic [ref=e78]: Spicy
                    - generic [ref=e79]: Main Course
                - generic [ref=e82]:
                  - generic [ref=e83]:
                    - button "Decrease quantity" [ref=e84]: "-"
                    - spinbutton "Quantity" [ref=e85]: "2"
                    - button "Increase quantity" [active] [ref=e86]: +
                  - button "View Details" [ref=e87]
      - generic [ref=e88]:
        - generic [ref=e89]:
          - paragraph [ref=e90]: Guest Information
          - heading "Service notes for your table" [level=2] [ref=e91]
        - article [ref=e93]:
          - paragraph [ref=e94]: Pairing Notes
          - heading "Guest Guidance" [level=3] [ref=e95]
          - generic [ref=e96]:
            - paragraph [ref=e98]: Please share allergy or dietary requests before selecting a dish detail page.
            - paragraph [ref=e100]: Ask the team for seasonal pairings, tasting order suggestions, and lighter alternatives.
    - button "Wave Staff" [ref=e101] [cursor=pointer]:
      - generic [ref=e102]: 👋
    - generic [ref=e103]:
      - generic:
        - generic:
          - button "Open BootChat":
            - img
          - button "Request Bill":
            - img
          - button "2 items in cart":
            - img
            - generic: "2"
      - button "Open quick actions" [ref=e104] [cursor=pointer]:
        - generic [ref=e105]: +
        - generic [ref=e106]: "2"
```

# Test source

```ts
  257 |               cancelled_by: null,
  258 |               accounted_by: null,
  259 |             },
  260 |           }),
  261 |         });
  262 |         return;
  263 |       }
  264 | 
  265 |       if (request.method() === 'GET' && path === `/api/table-session/${sessionId}/orders`) {
  266 |         await route.fulfill({
  267 |           status: 200,
  268 |           contentType: 'application/json',
  269 |           body: JSON.stringify({
  270 |             orders: submittedOrderId === 0
  271 |               ? []
  272 |               : [
  273 |                 {
  274 |                   id: submittedOrderId,
  275 |                   uuid: 'order-9901',
  276 |                   order_number: 'ORD-20260726-009901',
  277 |                   invoice_number: null,
  278 |                   status: 'staff_confirmed',
  279 |                   kitchen_status: 'ready',
  280 |                   table_session_id: sessionId,
  281 |                   table_reference: 'T01',
  282 |                   restaurant: tableMenuPayload.restaurant,
  283 |                   table: {
  284 |                     id: 901,
  285 |                     name: 'T01',
  286 |                   },
  287 |                   notes: 'بدون بصل 😋',
  288 |                   created_at: createdAt,
  289 |                   updated_at: createdAt,
  290 |                   confirmed_at: '2026-07-26T12:06:00.000Z',
  291 |                   items: [
  292 |                     {
  293 |                       id: 4401,
  294 |                       dish_id: 101,
  295 |                       dish_name: 'Mixed Grill Plate',
  296 |                       quantity: submittedQuantity,
  297 |                       unit_price: '12.50',
  298 |                       line_subtotal: (12.5 * submittedQuantity).toFixed(2),
  299 |                       status: 'normal',
  300 |                     },
  301 |                   ],
  302 |                   invoice: {
  303 |                     subtotal: (12.5 * submittedQuantity).toFixed(2),
  304 |                     discount_type: null,
  305 |                     discount_value: '0.00',
  306 |                     discount_amount: '0.00',
  307 |                     taxable_subtotal: (12.5 * submittedQuantity).toFixed(2),
  308 |                     vat_rate: '0.00',
  309 |                     vat_amount: '0.00',
  310 |                     total: (12.5 * submittedQuantity).toFixed(2),
  311 |                   },
  312 |                 },
  313 |               ],
  314 |           }),
  315 |         });
  316 |         return;
  317 |       }
  318 | 
  319 |       if (request.method() === 'GET' && path === `/api/table-session/${sessionId}/invoice-split`) {
  320 |         await route.fulfill({
  321 |           status: 404,
  322 |           contentType: 'application/json',
  323 |           body: JSON.stringify({ message: 'Not found' }),
  324 |         });
  325 |         return;
  326 |       }
  327 | 
  328 |       if (request.method() === 'POST' && path === '/api/analytics/track') {
  329 |         await route.fulfill({
  330 |           status: 200,
  331 |           contentType: 'application/json',
  332 |           body: JSON.stringify({ ok: true }),
  333 |         });
  334 |         return;
  335 |       }
  336 | 
  337 |       await route.fulfill({
  338 |         status: 404,
  339 |         contentType: 'application/json',
  340 |         body: JSON.stringify({ message: `Unhandled route: ${request.method()} ${path}` }),
  341 |       });
  342 |     });
  343 | 
  344 |     await page.goto('/menu/table/1');
  345 | 
  346 |     await expect(page.getByText('Cedar Flame')).toBeVisible();
  347 |     await expect(page.getByText('Unlock ordering for this table')).toBeVisible();
  348 | 
  349 |     await page.getByPlaceholder('0000').fill('2468');
  350 |     await page.getByRole('button', { name: 'Unlock Ordering' }).click();
  351 | 
  352 |     await expect(page.getByText('Protected actions are ready')).toBeVisible();
  353 |     await page.getByRole('button', { name: 'Add to Cart', exact: true }).click();
  354 |     await page.getByLabel('Increase quantity').click();
  355 | 
  356 |     await expect(page.getByRole('button', { name: /2 items in cart/i })).toBeVisible();
> 357 |     await page.getByRole('button', { name: /2 items in cart/i }).click();
      |                                                                  ^ Error: locator.click: Test timeout of 60000ms exceeded.
  358 | 
  359 |     await expect(page.getByRole('heading', { name: 'Review Your Order' })).toBeVisible();
  360 |     await page.getByRole('button', { name: 'Increase quantity' }).click();
  361 |     await expect(page.getByText('$37.50')).toBeVisible();
  362 | 
  363 |     await page.getByLabel('Notes for Team').fill('بدون بصل 😋');
  364 |     await page.getByRole('button', { name: 'Send Order Request' }).click();
  365 | 
  366 |     await expect(page.getByText('Order sent to the staff team')).toBeVisible();
  367 |     await expect(page.getByText('ORD-20260726-009901')).toBeVisible();
  368 |     await expect(page.getByText('$37.50')).toBeVisible();
  369 |     expect(lastIdempotencyKey).toBeTruthy();
  370 | 
  371 |     await page.getByRole('link', { name: 'View My Orders' }).click();
  372 | 
  373 |     await expect(page.getByRole('heading', { name: 'Your Orders' })).toBeVisible();
  374 |     await expect(page.getByText('staff confirmed')).toBeVisible();
  375 |     await expect(page.getByText('Mixed Grill Plate')).toBeVisible();
  376 |     await expect(page.getByText('$37.50')).toBeVisible();
  377 |   });
  378 | });
  379 | 
```