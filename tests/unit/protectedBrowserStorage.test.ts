import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getVerifiedBrowserIdentity, quarantineLegacyProtectedStorage, setVerifiedBrowserIdentity, waiterActionBelongsToCurrentAccount } from '../../src/services/protectedBrowserStorage';
import { appendCompensationAuditLogs, appendCompensationLedgerEntries, readCompensationAuditLogs, readCompensationLedger, type CompensationLedgerEntry } from '../../src/services/complaintCompensationService';
import { readBillAdjustmentsForTable, readBillAdjustmentsForTableInvoice, upsertBillAdjustmentsForTable } from '../../src/utils/billAdjustments';
import { loadPrintableInvoice, savePrintableInvoice, type PrintableInvoicePayload } from '../../src/utils/printableInvoice';

const activate = (restaurantId: number, userId: number) => {
  const token = `QA_RUN_scope_${restaurantId}_${userId}`;
  localStorage.setItem('admin_auth_token', token);
  setVerifiedBrowserIdentity({ id: userId, name: `QA_RUN_user_${userId}`, email: null, role: 'admin', restaurant: { id: restaurantId, name: `QA_RUN_tenant_${restaurantId}`, slug: `qa-run-${restaurantId}` } }, token);
};
const entry: CompensationLedgerEntry = { id: 'QA_RUN_scope_entry', created_at: '2026-10-07', source: 'pos', dish_name: 'QA_RUN_dish', quantity: 1, status: 'compensated', compensation_type: 'full_waiver', original_amount: 10, final_amount: 0, loss_amount: 10, is_complimentary: false, action: 'checkout' };
const invoice: PrintableInvoicePayload = { restaurantName: 'QA_RUN_tenant_A', tableName: 'T01', generatedAt: '2026-10-07', notes: [], items: [], includedOrders: [], summary: { subtotal: '$10', discountLabel: '', discountAmount: '$0', taxableSubtotal: '$10', vatLabel: '', vatAmount: '$0', total: '$10' } };

beforeEach(() => { localStorage.clear(); setVerifiedBrowserIdentity(null, null); });

describe('tenant and account ownership of persisted work', () => {
  it('isolates financial/audit/table data by restaurant and private print data by account', () => {
    activate(11, 1);
    appendCompensationLedgerEntries([entry]);
    appendCompensationAuditLogs([{ id: 'QA_RUN_audit', timestamp: '2026-10-07', actor_name: 'QA_RUN_A', actor_role: 'admin', action: 'checkout', message: 'QA_RUN_event', entry_id: entry.id, dish_name: entry.dish_name }]);
    upsertBillAdjustmentsForTable('T01', [{ key: 'QA_RUN_adjustment', dish_name: 'QA_RUN_A', status: 'compensated', compensation_type: 'full_waiver' }]);
    savePrintableInvoice(invoice);
    activate(22, 2);
    expect(readCompensationLedger()).toEqual([]);
    expect(readCompensationAuditLogs()).toEqual([]);
    expect(readBillAdjustmentsForTable('T01')).toEqual([]);
    expect(loadPrintableInvoice()).toBeNull();
    activate(11, 3);
    expect(readCompensationLedger()).toEqual([entry]);
    expect(readCompensationAuditLogs()[0].actor_name).toBe('QA_RUN_A');
    expect(readBillAdjustmentsForTable('T01')).toHaveLength(1);
    expect(loadPrintableInvoice()).toBeNull();
    activate(11, 1);
    expect(loadPrintableInvoice()).toEqual(invoice);
  });

  it('blocks writes from stale callbacks including a previous login of the same account', () => {
    activate(11, 1);
    const previous = getVerifiedBrowserIdentity();
    activate(22, 2);
    appendCompensationLedgerEntries([entry], previous);
    savePrintableInvoice(invoice, undefined, previous);
    expect(readCompensationLedger()).toEqual([]);
    expect(loadPrintableInvoice()).toBeNull();
    setVerifiedBrowserIdentity(null, null);
    activate(11, 1);
    appendCompensationLedgerEntries([entry], previous);
    expect(readCompensationLedger()).toEqual([]);
  });

  it('fails closed immediately when another tab replaces the token before the storage event is processed', () => {
    activate(11, 1);
    appendCompensationLedgerEntries([entry]);
    localStorage.setItem('admin_auth_token', 'QA_RUN_different_session');
    expect(readCompensationLedger()).toEqual([]);
    expect(getVerifiedBrowserIdentity()).toBeNull();
    expect(waiterActionBelongsToCurrentAccount({ restaurantId: 11, userId: 1 })).toBe(false);
  });

  it('never guesses ownership of old staff queues; supports only the same restaurant AND user', () => {
    activate(11, 1);
    expect(waiterActionBelongsToCurrentAccount()).toBe(false);
    expect(waiterActionBelongsToCurrentAccount({ restaurantId: 22, userId: 1 })).toBe(false);
    expect(waiterActionBelongsToCurrentAccount({ restaurantId: 11, userId: 2 })).toBe(false);
    expect(waiterActionBelongsToCurrentAccount({ restaurantId: 11, userId: 1 })).toBe(true);
  });

  it('keeps guest invoice and table caches separate by tenant, table and access credential', () => {
    activate(11, 1);
    upsertBillAdjustmentsForTable('T01', [{ key: 'QA_RUN_adjustment', dish_name: 'QA_RUN_A', status: 'compensated', compensation_type: 'full_waiver' }]);
    const guest = { restaurantId: 11, tableId: 1, guestAccessToken: 'QA_RUN_guest_A' };
    savePrintableInvoice(invoice, guest);
    activate(22, 2);
    expect(readBillAdjustmentsForTableInvoice('T01', [], 22)).toEqual([]);
    expect(readBillAdjustmentsForTableInvoice('T01', [], 11)).toHaveLength(1);
    expect(loadPrintableInvoice()).toBeNull();
    expect(loadPrintableInvoice({ ...guest, restaurantId: 22 })).toBeNull();
    expect(loadPrintableInvoice({ ...guest, tableId: 2 })).toBeNull();
    expect(loadPrintableInvoice({ ...guest, guestAccessToken: 'QA_RUN_guest_B' })).toBeNull();
    expect(loadPrintableInvoice(guest)).toEqual(invoice);
  });

  it('retains exact legacy bytes on quota failure and preserves separate quarantine snapshots', () => {
    const key = 'pos_compensation_ledger_v1';
    const first = JSON.stringify([entry]);
    localStorage.setItem(key, first);
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QA_RUN_quota'); });
    quarantineLegacyProtectedStorage();
    expect(localStorage.getItem(key)).toBe(first);
    expect(readCompensationLedger()).toEqual([]);
    write.mockRestore();
    quarantineLegacyProtectedStorage();
    expect(localStorage.getItem(key)).toBe(first);
    const second = JSON.stringify([{ ...entry, id: 'QA_RUN_second' }]);
    localStorage.setItem(key, second);
    quarantineLegacyProtectedStorage();
    const copies = Object.keys(localStorage).filter((k) => k.startsWith(`protected_quarantine_v1:${key}`)).map((k) => localStorage.getItem(k));
    expect(copies).toContain(first);
    expect(copies).toContain(second);
  });
});
