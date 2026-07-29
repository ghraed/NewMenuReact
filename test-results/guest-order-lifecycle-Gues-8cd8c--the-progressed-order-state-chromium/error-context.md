# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: guest-order-lifecycle.spec.ts >> Guest order lifecycle >> guest unlocks a table, reviews the cart, submits an order, and sees the progressed order state
- Location: tests/e2e/guest-order-lifecycle.spec.ts:4:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('$37.50').first()
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByText('$37.50').first()

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - 'button "Language: EN" [pressed] [ref=e5] [cursor=pointer]': EN
    - 'button "Language: AR" [ref=e6] [cursor=pointer]': AR
  - button "Switch to dark theme" [ref=e7] [cursor=pointer]:
    - img [ref=e9]
  - main [ref=e15]:
    - generic [ref=e16]:
      - generic [ref=e18]: A
      - heading "Alpha" [level=2] [ref=e20]
    - generic [ref=e22]:
      - generic [ref=e23]:
        - generic [ref=e24]:
          - paragraph [ref=e25]: View Only
          - heading "Unlock ordering for this table" [level=2] [ref=e26]
          - paragraph [ref=e27]: Guests can browse the menu for Table 1, but ordering, staff calls, and bill requests stay locked until the current temporary PIN is verified.
        - generic [ref=e28]: Table 1
      - generic [ref=e29]:
        - generic [ref=e30]:
          - text: Temporary PIN
          - textbox "Temporary PIN" [ref=e31]:
            - /placeholder: "0000"
        - button "Unlock Ordering" [disabled] [ref=e32]
    - generic [ref=e33]:
      - generic [ref=e34]:
        - paragraph [ref=e35]: Alpha
        - heading "Review Your Order" [level=1] [ref=e36]
      - link "Back to menu" [ref=e38] [cursor=pointer]:
        - /url: /menu/table/1
    - generic [ref=e39]:
      - generic [ref=e40]:
        - generic [ref=e41]:
          - generic [ref=e42]:
            - paragraph [ref=e43]: Cart
            - heading "3 items" [level=2] [ref=e44]
          - generic [ref=e45]: $16.50
        - article [ref=e47]:
          - generic [ref=e48]:
            - generic [ref=e49]:
              - heading "Fresh Lemon Mint" [level=3] [ref=e50]
              - paragraph [ref=e51]: "[dummy-dishes-seeder] Seeded sample dish 37 for Alpha in the Drinks category. Prepared with lemon juice, mint, sugar syrup, ice water."
            - button "Remove" [ref=e52] [cursor=pointer]
          - generic [ref=e53]:
            - generic [ref=e54]:
              - button "-" [ref=e55] [cursor=pointer]
              - generic [ref=e56]: "3"
              - button "+" [active] [ref=e57] [cursor=pointer]
            - generic [ref=e58]:
              - paragraph [ref=e59]: $5.50 each
              - paragraph [ref=e60]: $16.50
      - generic [ref=e61]:
        - paragraph [ref=e62]: Table Request
        - heading "Send this order to staff" [level=2] [ref=e63]
        - paragraph [ref=e64]: Your table is detected automatically from the QR code session. Staff will confirm or cancel the request before it reaches accounting.
        - generic [ref=e65]:
          - generic [ref=e66]:
            - paragraph [ref=e67]: Table reference
            - paragraph [ref=e68]: Table 1
          - generic [ref=e69]:
            - generic [ref=e70]: Notes for the team
            - textbox "Notes for the team" [ref=e71]:
              - /placeholder: Optional service note for the staff...
          - generic [ref=e72]: This table session is missing or expired. Scan the table QR code again.
          - button "Send Order Request" [disabled] [ref=e73]
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
```

# Test source

```ts
  266 |         });
  267 |         return;
  268 |       }
  269 | 
  270 |       if (request.method() === 'GET' && path === `/api/table-session/${sessionId}/orders`) {
  271 |         await route.fulfill({
  272 |           status: 200,
  273 |           contentType: 'application/json',
  274 |           body: JSON.stringify({
  275 |             orders: submittedOrderId === 0
  276 |               ? []
  277 |               : [
  278 |                 {
  279 |                   id: submittedOrderId,
  280 |                   uuid: 'order-9901',
  281 |                   order_number: 'ORD-20260726-009901',
  282 |                   invoice_number: null,
  283 |                   status: 'staff_confirmed',
  284 |                   kitchen_status: 'ready',
  285 |                   table_session_id: sessionId,
  286 |                   table_reference: 'T01',
  287 |                   restaurant: tableMenuPayload.restaurant,
  288 |                   table: {
  289 |                     id: 901,
  290 |                     name: 'T01',
  291 |                   },
  292 |                   notes: 'بدون بصل 😋',
  293 |                   created_at: createdAt,
  294 |                   updated_at: createdAt,
  295 |                   confirmed_at: '2026-07-26T12:06:00.000Z',
  296 |                   items: [
  297 |                     {
  298 |                       id: 4401,
  299 |                       dish_id: 101,
  300 |                       dish_name: 'Mixed Grill Plate',
  301 |                       quantity: submittedQuantity,
  302 |                       unit_price: '12.50',
  303 |                       line_subtotal: (12.5 * submittedQuantity).toFixed(2),
  304 |                       status: 'normal',
  305 |                     },
  306 |                   ],
  307 |                   invoice: {
  308 |                     subtotal: (12.5 * submittedQuantity).toFixed(2),
  309 |                     discount_type: null,
  310 |                     discount_value: '0.00',
  311 |                     discount_amount: '0.00',
  312 |                     taxable_subtotal: (12.5 * submittedQuantity).toFixed(2),
  313 |                     vat_rate: '0.00',
  314 |                     vat_amount: '0.00',
  315 |                     total: (12.5 * submittedQuantity).toFixed(2),
  316 |                   },
  317 |                 },
  318 |               ],
  319 |           }),
  320 |         });
  321 |         return;
  322 |       }
  323 | 
  324 |       if (request.method() === 'GET' && path === `/api/table-session/${sessionId}/invoice-split`) {
  325 |         await route.fulfill({
  326 |           status: 404,
  327 |           contentType: 'application/json',
  328 |           body: JSON.stringify({ message: 'Not found' }),
  329 |         });
  330 |         return;
  331 |       }
  332 | 
  333 |       if (request.method() === 'POST' && path === '/api/analytics/track') {
  334 |         await route.fulfill({
  335 |           status: 200,
  336 |           contentType: 'application/json',
  337 |           body: JSON.stringify({ ok: true }),
  338 |         });
  339 |         return;
  340 |       }
  341 | 
  342 |       await route.fulfill({
  343 |         status: 404,
  344 |         contentType: 'application/json',
  345 |         body: JSON.stringify({ message: `Unhandled route: ${request.method()} ${path}` }),
  346 |       });
  347 |     });
  348 | 
  349 |     await page.goto('/menu/table/1');
  350 | 
  351 |     await expect(page.getByText('Cedar Flame')).toBeVisible();
  352 |     await expect(page.getByText('Unlock ordering for this table')).toBeVisible();
  353 | 
  354 |     await page.getByPlaceholder('0000').fill('2468');
  355 |     await page.getByRole('button', { name: 'Unlock Ordering' }).click();
  356 | 
  357 |     await expect(page.getByText('Protected actions are ready')).toBeVisible();
  358 |     await page.getByRole('button', { name: 'Add to Cart', exact: true }).first().click();
  359 |     await page.getByLabel('Increase quantity').click();
  360 | 
  361 |     await expect(page.getByRole('link', { name: /items in cart/i })).toBeVisible();
  362 |     await page.getByRole('link', { name: /items in cart/i }).click();
  363 | 
  364 |     await expect(page.getByRole('heading', { name: 'Review Your Order' })).toBeVisible();
  365 |     await page.locator('article').first().getByRole('button', { name: '+' }).click();
> 366 |     await expect(page.getByText('$37.50').first()).toBeVisible();
      |                                                    ^ Error: expect(locator).toBeVisible() failed
  367 | 
  368 |     await page.getByRole('textbox', { name: /notes for the team/i }).fill('بدون بصل 😋');
  369 |     await page.getByRole('button', { name: 'Send Order Request' }).click();
  370 | 
  371 |     await expect(page.getByText('Order sent to the staff team')).toBeVisible();
  372 |     await expect(page.getByText('ORD-20260726-009901')).toBeVisible();
  373 |     await expect(page.getByText('$37.50')).toBeVisible();
  374 |     expect(lastIdempotencyKey).toBeTruthy();
  375 | 
  376 |     await page.getByRole('link', { name: 'View My Orders' }).click();
  377 | 
  378 |     await expect(page.getByRole('heading', { name: 'Your Orders' })).toBeVisible();
  379 |     await expect(page.getByText('staff confirmed')).toBeVisible();
  380 |     await expect(page.getByText('Mixed Grill Plate')).toBeVisible();
  381 |     await expect(page.getByText('$37.50').first()).toBeVisible();
  382 |   });
  383 | });
  384 | 
```