import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminStaffSchedulingPage from '../../src/pages/AdminStaffSchedulingPage';
import { AppThemeProvider } from '../../src/hooks/useGuestTheme';

const mockedScheduleService = vi.hoisted(() => ({
  fetchStaffSchedules: vi.fn(),
  createStaffShift: vi.fn(),
  updateStaffShift: vi.fn(),
}));

const mockedStaffService = vi.hoisted(() => ({
  fetchStaffMembers: vi.fn(),
}));

vi.mock('../../src/components/Admin/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../src/services/staffScheduleService', () => ({
  fetchStaffSchedules: mockedScheduleService.fetchStaffSchedules,
  createStaffShift: mockedScheduleService.createStaffShift,
  updateStaffShift: mockedScheduleService.updateStaffShift,
}));

vi.mock('../../src/services/staffService', () => ({
  fetchStaffMembers: mockedStaffService.fetchStaffMembers,
}));

describe('AdminStaffSchedulingPage', () => {
  const renderPage = () => render(
    <AppThemeProvider>
      <AdminStaffSchedulingPage />
    </AppThemeProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();

    mockedStaffService.fetchStaffMembers.mockResolvedValue([
      { id: 11, name: 'Maya', role: 'staff', email: 'maya@test.local', phone: null },
      { id: 22, name: 'Chef Sam', role: 'chef', email: null, phone: '+9617000000' },
    ]);

    mockedScheduleService.fetchStaffSchedules.mockResolvedValue([
      {
        id: 100,
        restaurant_id: 1,
        user_id: 11,
        shift_date: '2026-05-06',
        start_time: '09:00:00',
        end_time: '17:00:00',
        position: 'Floor',
        status: 'scheduled',
        notes: null,
        employee: { id: 11, name: 'Maya', role: 'staff', email: 'maya@test.local', phone: null },
      },
    ]);

    mockedScheduleService.createStaffShift.mockResolvedValue({
      id: 101,
      restaurant_id: 1,
      user_id: 22,
      shift_date: '2026-05-07',
      start_time: '10:00:00',
      end_time: '18:00:00',
      position: 'Kitchen',
      status: 'scheduled',
      notes: 'Prep',
      employee: { id: 22, name: 'Chef Sam', role: 'chef', email: null, phone: '+9617000000' },
    });

    mockedScheduleService.updateStaffShift.mockResolvedValue({
      id: 100,
      restaurant_id: 1,
      user_id: 11,
      shift_date: '2026-05-06',
      start_time: '09:00:00',
      end_time: '17:00:00',
      position: 'Floor',
      status: 'completed',
      notes: null,
      employee: { id: 11, name: 'Maya', role: 'staff', email: 'maya@test.local', phone: null },
    });
  });

  it('creates shifts with selected employee and updates shift status', async () => {
    renderPage();

    await screen.findByText('Scheduled Shifts');

    const employeeSelect = screen.getByLabelText('Employee') as HTMLSelectElement;
    fireEvent.change(employeeSelect, { target: { value: '22' } });
    expect(employeeSelect.value).toBe('22');

    fireEvent.change(screen.getByLabelText('Position'), { target: { value: 'kitchen' } });
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Prep' } });

    const createButton = screen.getByRole('button', { name: 'Create Shift' });
    const form = createButton.closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => {
      expect(mockedScheduleService.createStaffShift).toHaveBeenCalledTimes(1);
    });

    expect(mockedScheduleService.createStaffShift).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 22,
      position: 'kitchen',
      notes: 'Prep',
    }));

    const statusSelect = screen.getAllByDisplayValue('scheduled')[0] as HTMLSelectElement;
    fireEvent.change(statusSelect, { target: { value: 'completed' } });

    await waitFor(() => {
      expect(mockedScheduleService.updateStaffShift).toHaveBeenCalledWith(100, { status: 'completed' });
    });
  });

  it('blocks create when end time is before start time', async () => {
    renderPage();

    await screen.findByText('Scheduled Shifts');

    const employeeSelect = screen.getByLabelText('Employee') as HTMLSelectElement;
    fireEvent.change(employeeSelect, { target: { value: '11' } });

    fireEvent.change(screen.getByLabelText('Start Time'), { target: { value: '17:00' } });
    fireEvent.change(screen.getByLabelText('End Time'), { target: { value: '09:00' } });

    const createButton = screen.getByRole('button', { name: 'Create Shift' });
    const form = createButton.closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    fireEvent.change(screen.getByLabelText('Position'), { target: { value: 'floor' } });

    expect(mockedScheduleService.createStaffShift).not.toHaveBeenCalled();
  });
});
