import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPayrollManagementPage from '../../src/pages/AdminPayrollManagementPage';

const mockedPayrollService = vi.hoisted(() => ({
  fetchPayrollPeriods: vi.fn(),
  fetchPayrollSummary: vi.fn(),
  createPayrollPeriod: vi.fn(),
  updatePayrollPeriod: vi.fn(),
  upsertPayrollEntries: vi.fn(),
}));

const mockedStaffService = vi.hoisted(() => ({
  fetchStaffMembers: vi.fn(),
}));

vi.mock('../../src/components/Admin/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../src/services/payrollService', () => ({
  fetchPayrollPeriods: mockedPayrollService.fetchPayrollPeriods,
  fetchPayrollSummary: mockedPayrollService.fetchPayrollSummary,
  createPayrollPeriod: mockedPayrollService.createPayrollPeriod,
  updatePayrollPeriod: mockedPayrollService.updatePayrollPeriod,
  upsertPayrollEntries: mockedPayrollService.upsertPayrollEntries,
}));

vi.mock('../../src/services/staffService', () => ({
  fetchStaffMembers: mockedStaffService.fetchStaffMembers,
}));

vi.mock('../../src/contexts/useAuth', () => ({
  useAuth: () => ({
    user: { restaurant: { currency: 'USD' } },
  }),
}));

describe('AdminPayrollManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedStaffService.fetchStaffMembers.mockResolvedValue([
      { id: 11, name: 'Maya', role: 'staff', email: 'maya@test.local', phone: null },
    ]);

    mockedPayrollService.fetchPayrollPeriods.mockResolvedValue([
      {
        id: 1,
        restaurant_id: 5,
        period_start: '2026-05-01',
        period_end: '2026-05-15',
        status: 'draft',
        entries: [],
        totals: {
          gross_pay: 0,
          deductions: 0,
          tax: 0,
          net_pay: 0,
          employee_count: 0,
        },
      },
    ]);

    mockedPayrollService.fetchPayrollSummary.mockResolvedValue({
      date_from: '2026-05-01',
      date_to: '2026-05-31',
      mode: { period_status: 'approved_paid' },
      totals: {
        gross_pay: 2500,
        deductions: 100,
        tax: 150,
        net_pay: 2250,
        employee_count: 1,
      },
    });

    mockedPayrollService.createPayrollPeriod.mockResolvedValue({
      id: 2,
      restaurant_id: 5,
      period_start: '2026-05-16',
      period_end: '2026-05-31',
      status: 'draft',
      entries: [],
      totals: {
        gross_pay: 0,
        deductions: 0,
        tax: 0,
        net_pay: 0,
        employee_count: 0,
      },
    });

    mockedPayrollService.upsertPayrollEntries.mockResolvedValue({
      id: 1,
      restaurant_id: 5,
      period_start: '2026-05-01',
      period_end: '2026-05-15',
      status: 'draft',
      entries: [],
      totals: {
        gross_pay: 100,
        deductions: 10,
        tax: 10,
        net_pay: 80,
        employee_count: 1,
      },
    });

    mockedPayrollService.updatePayrollPeriod.mockResolvedValue({
      id: 1,
      restaurant_id: 5,
      period_start: '2026-05-01',
      period_end: '2026-05-15',
      status: 'approved',
      entries: [],
      totals: {
        gross_pay: 100,
        deductions: 10,
        tax: 10,
        net_pay: 80,
        employee_count: 1,
      },
    });
  });

  it('creates payroll period and saves entries in cents payload', async () => {
    render(<AdminPayrollManagementPage />);

    await screen.findByText('Periods & Entries');

    fireEvent.click(screen.getByRole('button', { name: 'Create Period' }));

    await waitFor(() => {
      expect(mockedPayrollService.createPayrollPeriod).toHaveBeenCalledTimes(1);
    });

    const mayaRow = screen.getByText('Maya').closest('tr');
    expect(mayaRow).not.toBeNull();
    const inputs = within(mayaRow as HTMLElement).getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '100.50' } }); // base
    fireEvent.change(inputs[1], { target: { value: '10.25' } }); // overtime

    fireEvent.click(screen.getByRole('button', { name: 'Save Entries' }));

    await waitFor(() => {
      expect(mockedPayrollService.upsertPayrollEntries).toHaveBeenCalledTimes(1);
    });

    expect(mockedPayrollService.upsertPayrollEntries).toHaveBeenCalledWith(1, [
      expect.objectContaining({
        user_id: 11,
        base_amount_cents: 10050,
        overtime_amount_cents: 1025,
      }),
    ]);
  });

  it('updates selected payroll period status', async () => {
    render(<AdminPayrollManagementPage />);

    await screen.findByText('Periods & Entries');

    fireEvent.click(screen.getByRole('button', { name: 'Mark Approved' }));

    await waitFor(() => {
      expect(mockedPayrollService.updatePayrollPeriod).toHaveBeenCalledWith(1, { status: 'approved' });
    });
  });

  it('blocks saving entries when net pay would be negative', async () => {
    render(<AdminPayrollManagementPage />);

    await screen.findByText('Periods & Entries');

    const mayaRow = screen.getByText('Maya').closest('tr');
    expect(mayaRow).not.toBeNull();
    const inputs = within(mayaRow as HTMLElement).getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '10.00' } }); // base
    fireEvent.change(inputs[3], { target: { value: '50.00' } }); // deduction

    fireEvent.click(screen.getByRole('button', { name: 'Save Entries' }));

    await screen.findByText(/Net pay cannot be negative for Maya/i);
    expect(mockedPayrollService.upsertPayrollEntries).not.toHaveBeenCalled();
  });
});
