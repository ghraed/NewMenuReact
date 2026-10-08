import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LoginPage from '../../src/pages/LoginPage';

const login = vi.hoisted(() => vi.fn().mockRejectedValue(new Error('QA failure')));
vi.mock('../../src/contexts/useAuth', () => ({ useAuth: () => ({ login, isAuthenticated: false, user: null }) }));

describe('login keyboard and error semantics', () => {
  it('keeps decoration outside the tab sequence and associates failed login with fields', async () => {
    const { container } = render(<LoginPage />);
    expect(container.querySelector('button[aria-hidden="true"]')).toBeNull();
    const identifier = screen.getByLabelText('Email or phone');
    const password = screen.getByLabelText('Password');
    fireEvent.change(identifier, { target: { value: 'QA_RUN_access@example.invalid' } });
    fireEvent.change(password, { target: { value: 'QA_RUN_password' } });
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => expect(screen.getByRole('alert')).toBeVisible());
    expect(identifier).toHaveAttribute('aria-describedby', 'login-error');
    expect(password).toHaveAttribute('aria-invalid', 'true');
    expect(identifier).toHaveAttribute('autocomplete', 'username');
    expect(password).toHaveAttribute('autocomplete', 'current-password');
  });
});
