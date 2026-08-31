import React, { useContext } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
const superAdminApi = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock('../../src/services/api', () => ({ default: api, resolveAssetUrl: (value: string) => value }));
vi.mock('../../src/services/superAdminApi', () => ({ default: superAdminApi }));
vi.mock('../../src/services/realtime', () => ({ resetEcho: vi.fn() }));

import { AuthContext, AuthProvider } from '../../src/contexts/AuthContext';
import { OrderCartContext, OrderCartProvider } from '../../src/contexts/OrderCartContext';
import { SuperAdminAuthContext, SuperAdminAuthProvider } from '../../src/contexts/SuperAdminAuthContext';

describe('browser credential persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('keeps restaurant and owner sessions across refresh via cookies without localStorage bearer tokens', async () => {
    localStorage.setItem('admin_auth_token', 'QA_RUN_SEC-legacy-staff-token');
    localStorage.setItem('owner_auth_token', 'QA_RUN_SEC-legacy-owner-token');
    api.get.mockRejectedValueOnce(new Error('not authenticated'));
    superAdminApi.get.mockRejectedValueOnce(new Error('not authenticated'));
    api.post.mockResolvedValueOnce({
      data: {
        token: 'QA_RUN_SEC-readable-response-token',
        user: { id: 1, name: 'QA_RUN_SEC Admin', role: 'admin', restaurant: { id: 1 } },
      },
    });
    superAdminApi.post.mockResolvedValueOnce({
      data: {
        token: 'QA_RUN_SEC-readable-owner-response-token',
        user: { id: 2, name: 'QA_RUN_SEC Owner', email: 'owner@example.test', role: 'saas_owner' },
      },
    });

    const StaffProbe = () => {
      const context = useContext(AuthContext)!;
      if (context.loading) return <span>staff-loading</span>;
      return <button onClick={() => void context.login('admin@example.test', 'password')}>staff-login</button>;
    };
    const OwnerProbe = () => {
      const context = useContext(SuperAdminAuthContext)!;
      if (context.loading) return <span>owner-loading</span>;
      return <button onClick={() => void context.login('owner@example.test', 'password')}>owner-login</button>;
    };

    render(
      <AuthProvider><StaffProbe /></AuthProvider>
    );
    render(
      <SuperAdminAuthProvider><OwnerProbe /></SuperAdminAuthProvider>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'staff-login' }));
    fireEvent.click(await screen.findByRole('button', { name: 'owner-login' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledTimes(1);
      expect(superAdminApi.post).toHaveBeenCalledTimes(1);
    });
    expect(localStorage.getItem('admin_auth_token')).toBeNull();
    expect(localStorage.getItem('owner_auth_token')).toBeNull();
  });

  it('persists cart data without the guest bearer credential', async () => {
    const GuestProbe = () => {
      const context = useContext(OrderCartContext)!;
      return (
        <button onClick={() => context.setGuestAccess({
          token: 'QA_RUN_SEC-readable-guest-token',
          expiresAt: '2026-09-01T12:00:00.000Z',
        })}>
          verify-guest
        </button>
      );
    };

    render(<OrderCartProvider><GuestProbe /></OrderCartProvider>);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'verify-guest' }));
    });

    await waitFor(() => expect(localStorage.getItem('guest_order_cart_state')).not.toBeNull());
    const stored = JSON.parse(localStorage.getItem('guest_order_cart_state') || '{}');
    expect(stored.draft.guestAccessToken).toBeNull();
    expect(stored.draft.guestAccessVerified).toBe(false);
    expect(JSON.stringify(stored)).not.toContain('QA_RUN_SEC-readable-guest-token');
  });
});
