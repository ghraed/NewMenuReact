import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import GuestPageShell from '../components/Guest/GuestPageShell';
import SectionHeading from '../components/Guest/SectionHeading';
import GuestInfoSection from '../components/Guest/GuestInfoSection';
import { useOrderCart } from '../contexts/useOrderCart';
import { createGuestOrder, fetchGuestTables } from '../services/orderService';
import type { OrderRecord, RestaurantTableSummary } from '../types';
import { formatRestaurantLabel, getPreferredGuestRestaurantSlug } from '../utils/guestRestaurant';

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) {
      return response.data.message;
    }
  }

  return fallback;
};

const OrderReviewPage: React.FC = () => {
  const {
    restaurant,
    items,
    draft,
    subtotal,
    updateDraft,
    updateQuantity,
    removeDish,
    clearCart,
  } = useOrderCart();

  const [submitting, setSubmitting] = useState(false);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tablesError, setTablesError] = useState<string | null>(null);
  const [tables, setTables] = useState<RestaurantTableSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submittedOrder, setSubmittedOrder] = useState<OrderRecord | null>(null);

  const restaurantSlug = submittedOrder?.restaurant.slug || restaurant?.slug || getPreferredGuestRestaurantSlug();
  const restaurantName = submittedOrder?.restaurant.name || restaurant?.name || formatRestaurantLabel(restaurantSlug);
  const canSubmit = items.length > 0 && draft.tableReference.trim().length > 0 && !submitting;
  const itemCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

  useEffect(() => {
    if (!restaurantSlug || submittedOrder) {
      return;
    }

    const loadTables = async () => {
      setTablesLoading(true);
      setTablesError(null);

      try {
        const response = await fetchGuestTables(restaurantSlug);
        setTables(response.tables);
      } catch (err: unknown) {
        setTablesError(getErrorMessage(err, 'Failed to load restaurant tables.'));
      } finally {
        setTablesLoading(false);
      }
    };

    loadTables();
  }, [restaurantSlug, submittedOrder]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (items.length === 0 || !restaurantSlug) {
      setError('Add at least one dish before sending an order request.');
      return;
    }

    if (!draft.tableReference.trim()) {
      setError('Select the table placing this order.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await createGuestOrder(restaurantSlug, {
        table_reference: draft.tableReference.trim(),
        notes: draft.notes.trim() || undefined,
        items: items.map((item) => ({
          dish_id: item.dishId,
          quantity: item.quantity,
        })),
      });

      setSubmittedOrder(response.order);
      clearCart();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to send your order request.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GuestPageShell>
      <main className="mx-auto max-w-5xl px-4 pb-12 pt-20 sm:px-6 sm:pb-14 sm:pt-24 lg:px-8">
        <SectionHeading
          title="Review Your Order"
          eyebrow={restaurantName}
          titleId="order-review-heading"
          aside={(
            <Link
              to={restaurantSlug ? `/menu/${restaurantSlug}` : '/'}
              className="inline-flex rounded-full border px-4 py-2 text-sm font-medium"
              style={{
                backgroundColor: 'var(--guest-panel)',
                borderColor: 'var(--guest-border)',
                color: 'var(--guest-text)',
              }}
            >
              Back to menu
            </Link>
          )}
        />

        {submittedOrder ? (
          <section
            className="rounded-[32px] border p-6 sm:p-8"
            style={{
              backgroundColor: 'var(--guest-panel)',
              borderColor: 'var(--guest-border)',
              boxShadow: 'var(--guest-shadow)',
            }}
          >
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--guest-accent)]">Request Received</p>
            <h2 className="mt-3 font-serif text-3xl text-[var(--guest-text)]">Order sent to the staff team</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--guest-muted)]">
              Your order for table
              {' '}
              <span className="font-semibold text-[var(--guest-text)]">{submittedOrder.table_reference}</span>
              {' '}
              is now waiting for staff confirmation.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div
                className="rounded-[24px] border p-5"
                style={{
                  backgroundColor: 'var(--guest-panel-strong)',
                  borderColor: 'var(--guest-border)',
                }}
              >
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--guest-accent)]">Order Number</p>
                <p className="mt-2 text-lg font-semibold text-[var(--guest-text)]">
                  {submittedOrder.order_number || 'Pending assignment'}
                </p>
              </div>

              <div
                className="rounded-[24px] border p-5"
                style={{
                  backgroundColor: 'var(--guest-panel-strong)',
                  borderColor: 'var(--guest-border)',
                }}
              >
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--guest-accent)]">Table</p>
                <p className="mt-2 text-lg font-semibold text-[var(--guest-text)]">
                  {submittedOrder.table_reference}
                </p>
              </div>

              <div
                className="rounded-[24px] border p-5"
                style={{
                  backgroundColor: 'var(--guest-panel-strong)',
                  borderColor: 'var(--guest-border)',
                }}
              >
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--guest-accent)]">Status</p>
                <p className="mt-2 text-lg font-semibold capitalize text-[var(--guest-text)]">
                  {submittedOrder.status.replace(/_/g, ' ')}
                </p>
              </div>
            </div>

            <div
              className="mt-6 rounded-[24px] border p-5"
              style={{
                backgroundColor: 'var(--guest-panel-strong)',
                borderColor: 'var(--guest-border)',
              }}
            >
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--guest-accent)]">Current Subtotal</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--guest-text)]">${submittedOrder.invoice.subtotal}</p>
              <p className="mt-2 text-sm text-[var(--guest-muted)]">
                Staff will confirm or cancel this request first. Accounting will only be applied after staff approval.
              </p>
            </div>
          </section>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <section
              className="rounded-[32px] border p-5 sm:p-6"
              style={{
                backgroundColor: 'var(--guest-panel)',
                borderColor: 'var(--guest-border)',
                boxShadow: 'var(--guest-shadow)',
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--guest-accent)]">Cart</p>
                  <h2 className="mt-2 font-serif text-3xl text-[var(--guest-text)]">{itemCount} item{itemCount === 1 ? '' : 's'}</h2>
                </div>
                <span
                  className="rounded-full border px-4 py-2 text-sm font-semibold"
                  style={{
                    backgroundColor: 'var(--guest-accent-soft)',
                    borderColor: 'var(--guest-border)',
                    color: 'var(--guest-accent)',
                  }}
                >
                  ${subtotal.toFixed(2)}
                </span>
              </div>

              {items.length === 0 ? (
                <div
                  className="mt-6 rounded-[24px] border p-6 text-center"
                  style={{
                    backgroundColor: 'var(--guest-panel-strong)',
                    borderColor: 'var(--guest-border)',
                    color: 'var(--guest-muted)',
                  }}
                >
                  Your cart is empty. Add dishes from the guest menu to start an order.
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {items.map((item) => (
                    <article
                      key={item.dishId}
                      className="rounded-[24px] border p-4"
                      style={{
                        backgroundColor: 'var(--guest-panel-strong)',
                        borderColor: 'var(--guest-border)',
                      }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="text-lg font-semibold text-[var(--guest-text)]">{item.name}</h3>
                          <p className="mt-1 text-sm leading-6 text-[var(--guest-muted)]">{item.description}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDish(item.dishId)}
                          className="rounded-full border px-3 py-1.5 text-xs font-semibold transition"
                          style={{
                            backgroundColor: 'transparent',
                            borderColor: 'var(--guest-border)',
                            color: 'var(--guest-muted)',
                          }}
                        >
                          Remove
                        </button>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-2 rounded-full border px-2 py-2" style={{ borderColor: 'var(--guest-border)' }}>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.dishId, item.quantity - 1)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border text-lg transition"
                            style={{
                              backgroundColor: 'var(--guest-panel)',
                              borderColor: 'var(--guest-border)',
                              color: 'var(--guest-text)',
                            }}
                          >
                            -
                          </button>
                          <span className="min-w-[2rem] text-center text-sm font-semibold text-[var(--guest-text)]">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.dishId, item.quantity + 1)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border text-lg transition"
                            style={{
                              backgroundColor: 'var(--guest-panel)',
                              borderColor: 'var(--guest-border)',
                              color: 'var(--guest-text)',
                            }}
                          >
                            +
                          </button>
                        </div>

                        <div className="text-right">
                          <p className="text-xs uppercase tracking-[0.24em] text-[var(--guest-accent)]">${item.price.toFixed(2)} each</p>
                          <p className="mt-1 text-lg font-semibold text-[var(--guest-text)]">
                            ${(item.price * item.quantity).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section
              className="rounded-[32px] border p-5 sm:p-6"
              style={{
                backgroundColor: 'var(--guest-panel)',
                borderColor: 'var(--guest-border)',
                boxShadow: 'var(--guest-shadow)',
              }}
            >
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--guest-accent)]">Table Request</p>
              <h2 className="mt-2 font-serif text-3xl text-[var(--guest-text)]">Send this order to staff</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--guest-muted)]">
                Select the table placing this order. Staff will confirm or cancel the request before it reaches accounting.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[var(--guest-text)]">Table reference</span>
                  <select
                    value={draft.tableReference}
                    onChange={(event) => updateDraft({ tableReference: event.target.value })}
                    className="w-full rounded-[22px] border px-4 py-3 text-sm outline-none transition"
                    style={{
                      backgroundColor: 'var(--guest-panel-strong)',
                      borderColor: 'var(--guest-border)',
                      color: 'var(--guest-text)',
                    }}
                    required
                  >
                    <option value="">Select a table</option>
                    {tables.map((table) => (
                      <option key={table.id} value={table.name}>
                        {table.name}
                      </option>
                    ))}
                  </select>
                </label>

                {tablesLoading ? (
                  <div
                    className="rounded-[22px] border p-4 text-sm"
                    style={{
                      backgroundColor: 'var(--guest-panel-strong)',
                      borderColor: 'var(--guest-border)',
                      color: 'var(--guest-muted)',
                    }}
                  >
                    Loading available tables...
                  </div>
                ) : null}

                {tablesError ? (
                  <div
                    className="rounded-[22px] border p-4 text-sm"
                    style={{
                      backgroundColor: 'color-mix(in srgb, rgb(var(--color-spicy)) 12%, var(--guest-panel))',
                      borderColor: 'color-mix(in srgb, rgb(var(--color-spicy)) 38%, var(--guest-border))',
                      color: 'rgb(var(--color-spicy))',
                    }}
                  >
                    {tablesError}
                  </div>
                ) : null}

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[var(--guest-text)]">Notes for the team</span>
                  <textarea
                    value={draft.notes}
                    onChange={(event) => updateDraft({ notes: event.target.value })}
                    className="min-h-[120px] w-full rounded-[22px] border px-4 py-3 text-sm outline-none transition"
                    style={{
                      backgroundColor: 'var(--guest-panel-strong)',
                      borderColor: 'var(--guest-border)',
                      color: 'var(--guest-text)',
                    }}
                    placeholder="Optional service note for the staff..."
                  />
                </label>

                {error ? (
                  <div
                    className="rounded-[22px] border p-4 text-sm"
                    style={{
                      backgroundColor: 'color-mix(in srgb, rgb(var(--color-spicy)) 12%, var(--guest-panel))',
                      borderColor: 'color-mix(in srgb, rgb(var(--color-spicy)) 38%, var(--guest-border))',
                      color: 'rgb(var(--color-spicy))',
                    }}
                  >
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="inline-flex w-full items-center justify-center rounded-full border px-6 py-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--guest-accent)',
                    borderColor: 'var(--guest-accent)',
                    color: 'var(--guest-accent-button-text)',
                    boxShadow: 'var(--guest-shadow-soft)',
                  }}
                >
                  {submitting ? 'Sending request...' : 'Send Order Request'}
                </button>
              </form>
            </section>
          </div>
        )}

        <GuestInfoSection restaurantName={restaurantName} />
      </main>
    </GuestPageShell>
  );
};

export default OrderReviewPage;
