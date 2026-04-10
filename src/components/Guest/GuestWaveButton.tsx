import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { GlassToast, useGlassToast } from '../ui/liquid-glass';
import { useOrderCart } from '../../contexts/useOrderCart';
import { fetchGuestTables, sendGuestWave } from '../../services/orderService';
import type { RestaurantTableSummary } from '../../types';
import { getPreferredGuestRestaurantSlug } from '../../utils/guestRestaurant';

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) {
      return response.data.message;
    }
  }

  return fallback;
};

const GuestWaveButton: React.FC = () => {
  const location = useLocation();
  const params = useParams<{ restaurant_slug?: string }>();
  const { restaurant, draft, updateDraft, totalItems } = useOrderCart();
  const { toast, showToast, dismiss } = useGlassToast(3200);

  const restaurantSlug = restaurant?.slug || params.restaurant_slug || getPreferredGuestRestaurantSlug();
  const hasCartShortcut = totalItems > 0 && location.pathname !== '/order/review';
  const selectedTable = draft.tableReference.trim();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [tablesError, setTablesError] = useState<string | null>(null);
  const [waveError, setWaveError] = useState<string | null>(null);
  const [tables, setTables] = useState<RestaurantTableSummary[]>([]);
  const [pendingTableReference, setPendingTableReference] = useState(selectedTable);

  useEffect(() => {
    setPendingTableReference(selectedTable);
  }, [selectedTable]);

  useEffect(() => {
    setTables([]);
    setTablesError(null);
  }, [restaurantSlug]);

  useEffect(() => {
    if (!isDialogOpen || !restaurantSlug || tables.length > 0) {
      return;
    }

    const loadTables = async () => {
      setIsLoadingTables(true);
      setTablesError(null);

      try {
        const response = await fetchGuestTables(restaurantSlug);
        setTables(response.tables);
      } catch (error: unknown) {
        setTablesError(getErrorMessage(error, 'Failed to load tables for this restaurant.'));
      } finally {
        setIsLoadingTables(false);
      }
    };

    loadTables();
  }, [isDialogOpen, restaurantSlug, tables.length]);

  const wrapperClassName = useMemo(() => (
    hasCartShortcut
      ? 'pointer-events-none fixed inset-x-4 bottom-20 z-40 flex justify-center sm:inset-x-auto sm:right-6 sm:bottom-24 sm:justify-end'
      : 'pointer-events-none fixed inset-x-4 bottom-4 z-40 flex justify-center sm:inset-x-auto sm:right-6 sm:bottom-6 sm:justify-end'
  ), [hasCartShortcut]);

  const submitWave = async (tableReference: string) => {
    if (!restaurantSlug) {
      setWaveError('No restaurant is selected for this guest session.');
      return;
    }

    setIsSending(true);
    setWaveError(null);

    try {
      const response = await sendGuestWave(restaurantSlug, {
        table_reference: tableReference,
      });
      updateDraft({ tableReference });
      setIsDialogOpen(false);
      showToast(response.message || 'Wave sent to the staff team.', 'primary', 3200);
    } catch (error: unknown) {
      setWaveError(getErrorMessage(error, 'Failed to send the wave to staff.'));
      setPendingTableReference(tableReference);
      setIsDialogOpen(true);
    } finally {
      setIsSending(false);
    }
  };

  const handleWaveClick = async () => {
    if (selectedTable) {
      await submitWave(selectedTable);
      return;
    }

    setWaveError(null);
    setIsDialogOpen(true);
  };

  const canSubmitDialog = pendingTableReference.trim().length > 0 && !isSending;

  return (
    <>
      <div className={wrapperClassName}>
        <div className="pointer-events-auto flex flex-col items-center gap-2 sm:items-end">
          <button
            type="button"
            onClick={handleWaveClick}
            disabled={isSending}
            className="inline-flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              backgroundColor: 'var(--guest-accent-soft)',
              borderColor: 'var(--guest-border)',
              color: 'var(--guest-text)',
              boxShadow: 'var(--guest-shadow-soft)',
            }}
          >
            <span aria-hidden="true" className="text-base leading-none">👋</span>
            <span>{isSending ? 'Waving...' : 'Wave Staff'}</span>
          </button>
        </div>
      </div>

      <GlassToast toast={toast} onClose={dismiss} />

      {isDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 py-6 sm:items-center">
          <div
            className="w-full max-w-md rounded-[30px] border p-5 sm:p-6"
            style={{
              backgroundColor: 'var(--guest-panel)',
              borderColor: 'var(--guest-border)',
              boxShadow: 'var(--guest-shadow)',
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-[var(--guest-accent)]">Wave Staff</p>
                <h3 className="mt-2 font-serif text-2xl text-[var(--guest-text)]">Choose your table</h3>
                <p className="mt-2 text-sm leading-7 text-[var(--guest-muted)]">
                  The staff team needs your table reference to know where to come.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsDialogOpen(false)}
                className="rounded-full border px-3 py-1.5 text-sm"
                style={{
                  backgroundColor: 'transparent',
                  borderColor: 'var(--guest-border)',
                  color: 'var(--guest-muted)',
                }}
              >
                Close
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--guest-text)]">Table reference</span>
                <select
                  value={pendingTableReference}
                  onChange={(event) => setPendingTableReference(event.target.value)}
                  className="themed-native-select w-full rounded-[22px] border px-4 py-3 text-sm outline-none transition"
                  style={{
                    backgroundColor: 'var(--guest-panel-strong)',
                    borderColor: 'var(--guest-border)',
                    color: 'var(--guest-text)',
                  }}
                >
                  <option value="">Select a table</option>
                  {tables.map((table) => (
                    <option key={table.id} value={table.name}>
                      {table.name}
                    </option>
                  ))}
                </select>
              </label>

              {isLoadingTables ? (
                <div
                  className="rounded-[22px] border px-4 py-3 text-sm"
                  style={{
                    backgroundColor: 'var(--guest-panel-strong)',
                    borderColor: 'var(--guest-border)',
                    color: 'var(--guest-muted)',
                  }}
                >
                  Loading restaurant tables...
                </div>
              ) : null}

              {tablesError ? (
                <div
                  className="rounded-[22px] border px-4 py-3 text-sm"
                  style={{
                    backgroundColor: 'color-mix(in srgb, rgb(var(--color-spicy)) 12%, var(--guest-panel))',
                    borderColor: 'color-mix(in srgb, rgb(var(--color-spicy)) 38%, var(--guest-border))',
                    color: 'rgb(var(--color-spicy))',
                  }}
                >
                  {tablesError}
                </div>
              ) : null}

              {waveError ? (
                <div
                  className="rounded-[22px] border px-4 py-3 text-sm"
                  style={{
                    backgroundColor: 'color-mix(in srgb, rgb(var(--color-spicy)) 12%, var(--guest-panel))',
                    borderColor: 'color-mix(in srgb, rgb(var(--color-spicy)) 38%, var(--guest-border))',
                    color: 'rgb(var(--color-spicy))',
                  }}
                >
                  {waveError}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => submitWave(pendingTableReference.trim())}
                disabled={!canSubmitDialog}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border px-6 py-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--guest-accent)',
                  borderColor: 'var(--guest-accent)',
                  color: 'var(--guest-accent-button-text)',
                  boxShadow: 'var(--guest-shadow-soft)',
                }}
              >
                <span aria-hidden="true" className="text-base leading-none">👋</span>
                <span>{isSending ? 'Sending Wave...' : 'Send Wave'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default GuestWaveButton;
