import { expect, test } from '@playwright/test';

test.describe('Guest order lifecycle', () => {
  test('guest unlocks a table, reviews the cart, submits an order, and sees the progressed order state', async ({ page }) => {
    const guestToken = 'guest-token-abc';
    const sessionId = 501;
    const tableId = 1;
    const createdAt = '2026-07-26T12:05:00.000Z';
    let submittedOrderId = 0;
    let submittedQuantity = 0;
    let lastIdempotencyKey: string | null = null;

    await page.route('**/api/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      const guestAccessToken = request.headers()['x-guest-access-token'];
      const isUnlocked = guestAccessToken === guestToken;

      const tableMenuPayload = {
        restaurant: {
          id: 77,
          name: 'Cedar Flame',
          slug: 'cedar-flame',
          logo_url: null,
          currency: 'USD',
          other_currency: 'LBP',
          dollar_rate: 89500,
          profile: {
            short_description: 'Levantine grill and mezze kitchen.',
          },
          feature_flags: {
            qr_menu: true,
            table_ordering: true,
            waiter_call: true,
            request_bill: true,
            invoice_splitting: false,
            ai_recommendations: true,
            multi_language: true,
          },
        },
        table: {
          id: tableId,
          number: tableId,
          restaurant_table_id: 901,
          name: 'T01',
        },
        table_session: {
          id: sessionId,
          uuid: 'session-501',
          status: 'active',
          table_id: tableId,
          table_reference: 'T01',
          opened_at: '2026-07-26T12:00:00.000Z',
          last_activity_at: '2026-07-26T12:04:00.000Z',
          expires_at: null,
          closed_at: null,
          close_reason: null,
          pin_locked_until: null,
          invoice_split_mode: null,
          invoice_split_count: null,
          active_guest_count: 1,
        },
        guest_access: isUnlocked
          ? {
            verified: true,
            token: guestToken,
            joined_at: '2026-07-26T12:01:00.000Z',
            last_seen_at: '2026-07-26T12:04:00.000Z',
            expires_at: null,
          }
          : {
            verified: false,
            token: null,
            joined_at: null,
            last_seen_at: null,
            expires_at: null,
          },
        protected_actions: {
          ordering_unlocked: isUnlocked,
          can_place_order: isUnlocked,
          can_call_waiter: isUnlocked,
          can_request_bill: isUnlocked,
        },
        dish_index: [
          {
            id: 101,
            uuid: 'dish-101',
            name: 'Mixed Grill Plate',
            name_ar: 'مشاوي مشكلة',
            description: 'Charcoal chicken, kafta, and lamb.',
            description_ar: 'دجاج وكفتة ولحم على الفحم.',
            category: 'Mains',
            category_ar: 'الأطباق الرئيسية',
            is_anchor: true,
            is_profitable: true,
            is_orderable: true,
            is_out_of_stock: false,
            image_url: null,
            ingredients: [],
          },
        ],
        dishes: [
          {
            id: 101,
            uuid: 'dish-101',
            name: 'Mixed Grill Plate',
            name_ar: 'مشاوي مشكلة',
            description: 'Charcoal chicken, kafta, and lamb.',
            description_ar: 'دجاج وكفتة ولحم على الفحم.',
            price: 12.5,
            currency: 'USD',
            category: 'Mains',
            category_ar: 'الأطباق الرئيسية',
            status: 'published',
            item_type: 'prepared_dish',
            is_anchor: true,
            is_profitable: true,
            is_orderable: true,
            is_out_of_stock: false,
            image_url: null,
            assets: [],
            dish_ingredients: [],
            suggested_dishes: [],
            related_dishes: [],
            created_at: createdAt,
            updated_at: createdAt,
          },
        ],
        dishes_page: [
          {
            id: 101,
            uuid: 'dish-101',
            name: 'Mixed Grill Plate',
            name_ar: 'مشاوي مشكلة',
            description: 'Charcoal chicken, kafta, and lamb.',
            description_ar: 'دجاج وكفتة ولحم على الفحم.',
            price: 12.5,
            currency: 'USD',
            category: 'Mains',
            category_ar: 'الأطباق الرئيسية',
            status: 'published',
            item_type: 'prepared_dish',
            is_anchor: true,
            is_profitable: true,
            is_orderable: true,
            is_out_of_stock: false,
            image_url: null,
            assets: [],
            dish_ingredients: [],
            suggested_dishes: [],
            related_dishes: [],
            created_at: createdAt,
            updated_at: createdAt,
          },
        ],
        dishes_meta: {
          total: 1,
          limit: 20,
          offset: 0,
          has_more: false,
          next_offset: null,
        },
      };

      if (request.method() === 'GET' && path === `/api/menu/table/${tableId}`) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(tableMenuPayload),
        });
        return;
      }

      if (request.method() === 'POST' && path === `/api/menu/table/${tableId}/verify-pin`) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Ordering unlocked for this table.',
            restaurant: tableMenuPayload.restaurant,
            table: tableMenuPayload.table,
            table_session: tableMenuPayload.table_session,
            guest_access: {
              verified: true,
              token: guestToken,
              joined_at: '2026-07-26T12:01:00.000Z',
              last_seen_at: '2026-07-26T12:04:00.000Z',
              expires_at: null,
            },
            protected_actions: {
              ordering_unlocked: true,
              can_place_order: true,
              can_call_waiter: true,
              can_request_bill: true,
            },
          }),
        });
        return;
      }

      if (request.method() === 'POST' && path === `/api/table-session/${sessionId}/order`) {
        const body = request.postDataJSON() as {
          notes?: string;
          items: Array<{ dish_id: number; quantity: number }>;
        };

        submittedQuantity = body.items[0]?.quantity ?? 0;
        submittedOrderId = 9901;
        lastIdempotencyKey = request.headers()['x-idempotency-key'] ?? null;

        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Order created successfully.',
            order: {
              id: submittedOrderId,
              uuid: 'order-9901',
              order_number: 'ORD-20260726-009901',
              invoice_number: null,
              status: 'pending_staff_confirmation',
              kitchen_status: null,
              table_session_id: sessionId,
              table_reference: 'T01',
              restaurant: tableMenuPayload.restaurant,
              table: {
                id: 901,
                name: 'T01',
              },
              notes: body.notes ?? '',
              created_at: createdAt,
              updated_at: createdAt,
              confirmed_at: null,
              items: [
                {
                  id: 4401,
                  dish_id: 101,
                  dish_name: 'Mixed Grill Plate',
                  quantity: submittedQuantity,
                  unit_price: '12.50',
                  line_subtotal: (12.5 * submittedQuantity).toFixed(2),
                  status: 'normal',
                },
              ],
              invoice: {
                subtotal: (12.5 * submittedQuantity).toFixed(2),
                discount_type: null,
                discount_value: '0.00',
                discount_amount: '0.00',
                taxable_subtotal: (12.5 * submittedQuantity).toFixed(2),
                vat_rate: '0.00',
                vat_amount: '0.00',
                total: (12.5 * submittedQuantity).toFixed(2),
              },
              confirmed_by: null,
              cancelled_by: null,
              accounted_by: null,
            },
          }),
        });
        return;
      }

      if (request.method() === 'GET' && path === `/api/table-session/${sessionId}/orders`) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            orders: submittedOrderId === 0
              ? []
              : [
                {
                  id: submittedOrderId,
                  uuid: 'order-9901',
                  order_number: 'ORD-20260726-009901',
                  invoice_number: null,
                  status: 'staff_confirmed',
                  kitchen_status: 'ready',
                  table_session_id: sessionId,
                  table_reference: 'T01',
                  restaurant: tableMenuPayload.restaurant,
                  table: {
                    id: 901,
                    name: 'T01',
                  },
                  notes: 'بدون بصل 😋',
                  created_at: createdAt,
                  updated_at: createdAt,
                  confirmed_at: '2026-07-26T12:06:00.000Z',
                  items: [
                    {
                      id: 4401,
                      dish_id: 101,
                      dish_name: 'Mixed Grill Plate',
                      quantity: submittedQuantity,
                      unit_price: '12.50',
                      line_subtotal: (12.5 * submittedQuantity).toFixed(2),
                      status: 'normal',
                    },
                  ],
                  invoice: {
                    subtotal: (12.5 * submittedQuantity).toFixed(2),
                    discount_type: null,
                    discount_value: '0.00',
                    discount_amount: '0.00',
                    taxable_subtotal: (12.5 * submittedQuantity).toFixed(2),
                    vat_rate: '0.00',
                    vat_amount: '0.00',
                    total: (12.5 * submittedQuantity).toFixed(2),
                  },
                },
              ],
          }),
        });
        return;
      }

      if (request.method() === 'GET' && path === `/api/table-session/${sessionId}/invoice-split`) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Not found' }),
        });
        return;
      }

      if (request.method() === 'POST' && path === '/api/analytics/track') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true }),
        });
        return;
      }

      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: `Unhandled route: ${request.method()} ${path}` }),
      });
    });

    await page.goto('/menu/table/1');

    await expect(page.getByText('Cedar Flame')).toBeVisible();
    await expect(page.getByText('Unlock ordering for this table')).toBeVisible();

    await page.getByPlaceholder('0000').fill('2468');
    await page.getByRole('button', { name: 'Unlock Ordering' }).click();

    await expect(page.getByText('Protected actions are ready')).toBeVisible();
    await page.getByRole('button', { name: 'Add to Cart', exact: true }).click();
    await page.getByLabel('Increase quantity').click();

    await expect(page.getByRole('button', { name: /2 items in cart/i })).toBeVisible();
    await page.getByRole('button', { name: /2 items in cart/i }).click();

    await expect(page.getByRole('heading', { name: 'Review Your Order' })).toBeVisible();
    await page.getByRole('button', { name: 'Increase quantity' }).click();
    await expect(page.getByText('$37.50')).toBeVisible();

    await page.getByLabel('Notes for Team').fill('بدون بصل 😋');
    await page.getByRole('button', { name: 'Send Order Request' }).click();

    await expect(page.getByText('Order sent to the staff team')).toBeVisible();
    await expect(page.getByText('ORD-20260726-009901')).toBeVisible();
    await expect(page.getByText('$37.50')).toBeVisible();
    expect(lastIdempotencyKey).toBeTruthy();

    await page.getByRole('link', { name: 'View My Orders' }).click();

    await expect(page.getByRole('heading', { name: 'Your Orders' })).toBeVisible();
    await expect(page.getByText('staff confirmed')).toBeVisible();
    await expect(page.getByText('Mixed Grill Plate')).toBeVisible();
    await expect(page.getByText('$37.50')).toBeVisible();
  });
});
