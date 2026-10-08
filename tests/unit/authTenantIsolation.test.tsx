import { AUTH_SESSION_STORAGE_KEY, AUTH_IDENTITY_STORAGE_KEY } from '../../src/services/browserAuthSession';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { AuthProvider, AuthScopeBoundary } from '../../src/contexts/AuthContext';
import { useAuth } from '../../src/contexts/useAuth';
import { appendCompensationLedgerEntries, readCompensationLedger, type CompensationLedgerEntry } from '../../src/services/complaintCompensationService';
import { loadPrintableInvoice, savePrintableInvoice, type PrintableInvoicePayload } from '../../src/utils/printableInvoice';
import type { AuthUserSummary } from '../../src/types';
import { OrderCartProvider } from '../../src/contexts/OrderCartContext';
import { useOrderCart } from '../../src/contexts/useOrderCart';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../../src/services/api', () => ({ default: http, resolveAssetUrl: (value: string) => value }));
vi.mock('../../src/services/realtime', () => ({ resetEcho: vi.fn() }));

const user = (id: number, restaurantId: number | null): AuthUserSummary => ({
  id, name: `QA_RUN_unit_user_${id}`, email: `QA_RUN_unit_${id}@example.invalid`, role: 'admin',
  restaurant: restaurantId === null ? null : { id: restaurantId, name: `QA_RUN_unit_restaurant_${restaurantId}`, slug: `qa-run-unit-${restaurantId}` },
});
const entry: CompensationLedgerEntry = {
  id: 'QA_RUN_unit_entry_A', created_at: '2026-10-07T12:00:00Z', source: 'pos', dish_name: 'QA_RUN_unit_A_dish',
  quantity: 1, status: 'compensated', compensation_type: 'complimentary', original_amount: 10,
  final_amount: 0, loss_amount: 10, is_complimentary: true, action: 'marked_complimentary',
};
const invoice: PrintableInvoicePayload = {
  restaurantName: 'QA_RUN_unit_A', tableName: 'T01', generatedAt: '2026-10-07T12:00:00Z', notes: [], items: [], includedOrders: [],
  summary: { subtotal: '$10.00', discountLabel: '', discountAmount: '$0.00', taxableSubtotal: '$10.00', vatLabel: '', vatAmount: '$0.00', total: '$10.00' },
};

function FinancialView() {
  const auth = useAuth();
  const [held, setHeld] = useState(false);
  const [revision, setRevision] = useState(0);
  return <>
    <span data-testid="user">{auth.user?.id ?? 'none'}</span>
    <span data-testid="ledger">{readCompensationLedger().length}</span>
    <span data-testid="held">{String(held)}</span>
    <span data-testid="invoice">{loadPrintableInvoice()?.restaurantName ?? 'none'}</span>
    <span>{revision}</span>
    <button onClick={() => void auth.login('A', 'QA_RUN_unit_password').catch(() => {})}>Login A</button>
    <button onClick={() => void auth.login('B', 'QA_RUN_unit_password').catch(() => {})}>Login B</button>
    <button onClick={() => void auth.logout()}>Logout</button>
    <button onClick={() => void auth.refreshUser().catch(() => {})}>Refresh</button>
    <button onClick={() => { appendCompensationLedgerEntries([entry]); savePrintableInvoice(invoice); setHeld(true); setRevision((n) => n + 1); }}>Create A work</button>
  </>;
}

function AccountView() {
  return <AuthScopeBoundary><FinancialView /></AuthScopeBoundary>;
}

function PublicGuestWork() {
  const auth = useAuth();
  const cart = useOrderCart();
  const [memoryNote, setMemoryNote] = useState('QA_RUN_initial_guest_note');
  return <>
    <span data-testid="guest-memory">{memoryNote}</span>
    <span data-testid="guest-draft">{cart.draft.notes}</span>
    <button onClick={() => { setMemoryNote('QA_RUN_changed_guest_note'); cart.updateDraft({ notes: 'QA_RUN_changed_guest_note' }); }}>Edit guest work</button>
    <button onClick={() => void auth.login('B', 'QA_RUN_unit_password').catch(() => {})}>Public login B</button>
  </>;
}

beforeEach(() => {
  localStorage.clear(); // Fresh jsdom fixture only; application code must never clear browser storage.
  vi.resetAllMocks();
  http.post.mockImplementation(async (path, body) => path === '/auth/login'
    ? { data: { token: `QA_RUN_unit_token_${body.email}`, user: body.email === 'A' ? user(1, 11) : user(2, 22) } }
    : { data: {} });
});

describe('actual auth provider and protected persistence', () => {
  it('keeps guest work available during unresolved staff auth and preserves its in-memory state across account changes', async () => {
    localStorage.setItem('admin_auth_token', 'QA_RUN_unit_token_A');
    let resolveMe!: (value: unknown) => void;
    http.get.mockReturnValueOnce(new Promise((resolve) => { resolveMe = resolve; }));
    render(<AuthProvider><OrderCartProvider><PublicGuestWork /><AccountView /></OrderCartProvider></AuthProvider>);
    fireEvent.click(screen.getByText('Edit guest work'));
    expect(screen.getByTestId('guest-memory')).toHaveTextContent('QA_RUN_changed_guest_note');
    expect(screen.queryByTestId('ledger')).toBeNull();
    fireEvent.click(screen.getByText('Public login B'));
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('2'));
    await act(async () => { resolveMe({ data: { user: user(1, 11) } }); });
    expect(screen.getByTestId('user')).toHaveTextContent('2');
    expect(screen.getByTestId('guest-memory')).toHaveTextContent('QA_RUN_changed_guest_note');
    expect(screen.getByTestId('guest-draft')).toHaveTextContent('QA_RUN_changed_guest_note');
  });

  it('isolates ledger, printable invoice and in-memory held work across A -> logout -> B -> A', async () => {
    render(<AuthProvider><AccountView /></AuthProvider>);
    fireEvent.click(await screen.findByText('Login A'));
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('1'));
    fireEvent.click(screen.getByText('Create A work'));
    expect(screen.getByTestId('ledger')).toHaveTextContent('1');
    fireEvent.click(screen.getByText('Logout'));
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('none'));
    expect(screen.getByTestId('ledger')).toHaveTextContent('0');
    expect(screen.getByTestId('held')).toHaveTextContent('false');
    fireEvent.click(screen.getByText('Login B'));
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('2'));
    expect(screen.getByTestId('ledger')).toHaveTextContent('0');
    expect(screen.getByTestId('invoice')).toHaveTextContent('none');
    fireEvent.click(screen.getByText('Login A'));
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('1'));
    expect(screen.getByTestId('ledger')).toHaveTextContent('1');
    expect(screen.getByTestId('invoice')).toHaveTextContent('QA_RUN_unit_A');
  });

  it('quarantines legacy financial history without assigning it to unresolved or first authenticated tenants', async () => {
    const legacy = JSON.stringify([entry]);
    localStorage.setItem('pos_compensation_ledger_v1', legacy);
    localStorage.setItem('i18nextLng', 'ar');
    localStorage.setItem('guest_order_cart_state', 'QA_RUN_preserved_guest_work');
    render(<AuthProvider><AccountView /></AuthProvider>);
    await screen.findByText('Login A');
    expect(screen.getByTestId('ledger')).toHaveTextContent('0');
    expect(localStorage.getItem('protected_quarantine_v1:pos_compensation_ledger_v1')).toBe(legacy);
    fireEvent.click(screen.getByText('Login A'));
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('1'));
    expect(screen.getByTestId('ledger')).toHaveTextContent('0');
    expect(localStorage.getItem('i18nextLng')).toBe('ar');
    expect(localStorage.getItem('guest_order_cart_state')).toBe('QA_RUN_preserved_guest_work');
  });

  it('fails closed on failed login and a user with no restaurant identity', async () => {
    render(<AuthProvider><AccountView /></AuthProvider>);
    fireEvent.click(await screen.findByText('Login A'));
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('1'));
    fireEvent.click(screen.getByText('Create A work'));
    http.post.mockRejectedValueOnce(new Error('QA_RUN denied login'));
    fireEvent.click(screen.getByText('Login B'));
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('none'));
    expect(readCompensationLedger()).toEqual([]);
    http.post.mockResolvedValueOnce({ data: { token: 'QA_RUN_unit_unresolved', user: user(3, null) } });
    fireEvent.click(screen.getByText('Login B'));
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('3'));
    expect(readCompensationLedger()).toEqual([]);
    appendCompensationLedgerEntries([entry]);
    expect(readCompensationLedger()).toEqual([]);
  });

  it('does not resurrect A when its delayed /me returns after logout and B login', async () => {
    let resolveMe!: (value: unknown) => void;
    http.get.mockRejectedValueOnce(new Error('QA_RUN no cookie'));
    render(<AuthProvider><AccountView /></AuthProvider>);
    fireEvent.click(await screen.findByText('Login A'));
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('1'));
    http.get.mockReturnValueOnce(new Promise((resolve) => { resolveMe = resolve; }));
    fireEvent.click(screen.getByText('Refresh'));
    fireEvent.click(screen.getByText('Logout'));
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('none'));
    fireEvent.click(screen.getByText('Login B'));
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('2'));
    await act(async () => { resolveMe({ data: { user: user(1, 11) } }); });
    expect(screen.getByTestId('user')).toHaveTextContent('2');
  });

  it('ignores a delayed successful A login after B has already logged in', async () => {
    let resolveA!: (value: unknown) => void;
    http.post.mockImplementation(async (_, body) => body.email === 'A'
      ? new Promise((resolve) => { resolveA = resolve; })
      : { data: { token: 'QA_RUN_unit_token_B', user: user(2, 22) } });
    render(<AuthProvider><AccountView /></AuthProvider>);
    fireEvent.click(await screen.findByText('Login A'));
    fireEvent.click(screen.getByText('Login B'));
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('2'));
    await act(async () => { resolveA({ data: { token: 'QA_RUN_unit_token_A', user: user(1, 11) } }); });
    expect(screen.getByTestId('user')).toHaveTextContent('2');
    expect(localStorage.getItem('admin_auth_token')).toBeNull();
    expect(localStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(AUTH_IDENTITY_STORAGE_KEY)!)).toEqual({ userId: 2, restaurantId: 22 });
  });

  it('invalidates A immediately and leaves a new B session intact when A logout returns late', async () => {
    let resolveLogout!: (value: unknown) => void;
    render(<AuthProvider><AccountView /></AuthProvider>);
    fireEvent.click(await screen.findByText('Login A'));
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('1'));
    fireEvent.click(screen.getByText('Create A work'));
    http.post.mockReturnValueOnce(new Promise((resolve) => { resolveLogout = resolve; }));
    fireEvent.click(screen.getByText('Logout'));
    expect(readCompensationLedger()).toEqual([]);
    fireEvent.click(await screen.findByText('Login B'));
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('2'));
    await act(async () => { resolveLogout({ data: {} }); });
    expect(screen.getByTestId('user')).toHaveTextContent('2');
    expect(localStorage.getItem('admin_auth_token')).toBeNull();
    expect(localStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(AUTH_IDENTITY_STORAGE_KEY)!)).toEqual({ userId: 2, restaurantId: 22 });
  });

  it('withholds protected descendants during cross-tab identity resolution', async () => {
    let resolveMe!: (value: unknown) => void;
    render(<AuthProvider><AccountView /></AuthProvider>);
    fireEvent.click(await screen.findByText('Login A'));
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('1'));
    fireEvent.click(screen.getByText('Create A work'));
    http.get.mockReturnValueOnce(new Promise((resolve) => { resolveMe = resolve; }));
    localStorage.setItem('admin_auth_token', 'QA_RUN_unit_token_B');
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'admin_auth_token', newValue: 'QA_RUN_unit_token_B' })); });
    expect(readCompensationLedger()).toEqual([]);
    await waitFor(() => expect(screen.queryByTestId('ledger')).toBeNull());
    await act(async () => { resolveMe({ data: { user: user(2, 22) } }); });
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('2'));
    expect(screen.getByTestId('held')).toHaveTextContent('false');
    expect(screen.getByTestId('invoice')).toHaveTextContent('none');
  });
  it('fails closed immediately when a cookie identity changes without a revision event', async () => {
    render(<AuthProvider><AccountView /></AuthProvider>);
    fireEvent.click(await screen.findByText('Login A'));
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('1'));
    fireEvent.click(screen.getByText('Create A work'));
    expect(readCompensationLedger()).toHaveLength(1);
    localStorage.setItem(AUTH_IDENTITY_STORAGE_KEY, JSON.stringify({ userId: 2, restaurantId: 22 }));
    expect(readCompensationLedger()).toEqual([]);
  });

});
