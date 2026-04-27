import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ReservationsPage from '../../src/pages/ReservationsPage';

const mockedService = vi.hoisted(() => ({
  fetchPublicRoomPlans: vi.fn(),
  fetchPublicRoomPlan: vi.fn(),
  fetchTableAvailability: vi.fn(),
  createPublicReservation: vi.fn(),
}));

vi.mock('../../src/services/roomPlanService', () => ({
  fetchPublicRoomPlans: mockedService.fetchPublicRoomPlans,
  fetchPublicRoomPlan: mockedService.fetchPublicRoomPlan,
  fetchTableAvailability: mockedService.fetchTableAvailability,
  createPublicReservation: mockedService.createPublicReservation,
}));

describe('ReservationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedService.fetchPublicRoomPlans.mockResolvedValue({
      restaurant: { id: 1, name: 'Test', slug: 'test' },
      room_plans: [{ id: 10, restaurant_id: 1, name: 'Main Plan', width: 700, height: 450 }],
    });

    mockedService.fetchPublicRoomPlan.mockResolvedValue({
      id: 10,
      restaurant_id: 1,
      name: 'Main Plan',
      width: 700,
      height: 450,
      items: [
        {
          id: 100,
          room_plan_id: 10,
          type: 'table',
          label: 'T1',
          x: 40,
          y: 40,
          width: 120,
          height: 120,
          rotation: 0,
          seats: 4,
          z_index: 1,
          container: 'room',
          is_active: true,
        },
        {
          id: 101,
          room_plan_id: 10,
          type: 'table',
          label: 'T2',
          x: 220,
          y: 40,
          width: 120,
          height: 120,
          rotation: 0,
          seats: 2,
          z_index: 2,
          container: 'room',
          is_active: true,
        },
      ],
    });

    mockedService.fetchTableAvailability.mockResolvedValue([
      { room_plan_item_id: 100, label: 'T1', status: 'reserved', color: 'orange', is_selectable: false },
      { room_plan_item_id: 101, label: 'T2', status: 'free', color: 'green', is_selectable: true },
    ]);

    mockedService.createPublicReservation.mockResolvedValue({ id: 1 });
  });

  it('blocks unavailable table selection and submits selected available table', async () => {
    render(<ReservationsPage />);

    const unavailable = await screen.findByRole('button', { name: /T1/i });
    const available = await screen.findByRole('button', { name: /T2/i });

    expect(unavailable).toBeDisabled();
    expect(available).toBeEnabled();

    fireEvent.click(available);

    fireEvent.change(screen.getByPlaceholderText('Customer name'), { target: { value: 'Rania' } });
    fireEvent.change(screen.getByPlaceholderText('Customer phone'), { target: { value: '+96170000001' } });

    fireEvent.click(screen.getByRole('button', { name: /Reserve Selected Table/i }));

    await waitFor(() => {
      expect(mockedService.createPublicReservation).toHaveBeenCalledTimes(1);
    });

    expect(mockedService.createPublicReservation.mock.calls[0][0]).toMatchObject({
      room_plan_item_id: 101,
      customer_name: 'Rania',
      customer_phone: '+96170000001',
    });
  });
});
