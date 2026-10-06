import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminUserProfilePage from '../../src/pages/AdminUserProfilePage';
import { AppThemeProvider } from '../../src/hooks/useGuestTheme';

const mocks = vi.hoisted(() => ({ patch: vi.fn(), put: vi.fn(), refreshUser: vi.fn() }));

vi.mock('../../src/services/api', () => ({ default: { patch: mocks.patch, put: mocks.put } }));
vi.mock('../../src/components/Admin/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('../../src/contexts/useAuth', () => ({
  useAuth: () => ({ user: { id: 1, name: 'QA_RUN_20261006_Admin', email: 'QA_RUN_20261006@example.invalid', phone: null }, refreshUser: mocks.refreshUser }),
}));

describe('AdminUserProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.patch.mockResolvedValue({ data: {} });
    mocks.refreshUser.mockResolvedValue({ name: 'QA_RUN_20261006_Updated' });
  });

  const renderPage = () => render(<AppThemeProvider><AdminUserProfilePage /></AppThemeProvider>);

  it('saves name and phone with the registered PATCH endpoint', async () => {
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Enter your full name'), { target: { value: ' QA_RUN_20261006_Updated ' } });
    fireEvent.change(screen.getByPlaceholderText('Enter your phone number'), { target: { value: ' +15550001001 ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }));
    await screen.findByText('Profile updated successfully.');
    expect(mocks.patch).toHaveBeenCalledWith('/auth/me', { name: 'QA_RUN_20261006_Updated', phone: '+15550001001' });
    expect(mocks.refreshUser).toHaveBeenCalledTimes(1);
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('preserves password whitespace and clears password inputs after success', async () => {
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Minimum 8 characters'), { target: { value: ' QA_RUN_new_password ' } });
    fireEvent.change(screen.getByPlaceholderText('Re-enter password'), { target: { value: ' QA_RUN_new_password ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }));
    await screen.findByText('Profile updated successfully.');
    expect(mocks.patch).toHaveBeenCalledWith('/auth/me', expect.objectContaining({ password: ' QA_RUN_new_password ', password_confirmation: ' QA_RUN_new_password ' }));
    expect(screen.getByPlaceholderText('Minimum 8 characters')).toHaveValue('');
    expect(screen.getByPlaceholderText('Re-enter password')).toHaveValue('');
  });

  it('retains form values and displays validation failure without refreshing or using PUT', async () => {
    mocks.patch.mockRejectedValueOnce({ response: { status: 422, data: { message: 'The phone has already been taken.' } } });
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Enter your phone number'), { target: { value: '+15550001001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }));
    await screen.findByText('The phone has already been taken.');
    expect(screen.getByPlaceholderText('Enter your phone number')).toHaveValue('+15550001001');
    expect(mocks.refreshUser).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Profile' })).toBeEnabled());
  });

  it('blocks mismatched password confirmation before sending an update', async () => {
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Minimum 8 characters'), { target: { value: 'QA_RUN_password' } });
    fireEvent.change(screen.getByPlaceholderText('Re-enter password'), { target: { value: 'QA_RUN_other' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }));
    expect(await screen.findByText('Password and confirmation must match.')).toBeVisible();
    expect(mocks.patch).not.toHaveBeenCalled();
  });
});
