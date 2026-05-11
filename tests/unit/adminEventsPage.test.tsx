import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminEventsPage from '../../src/pages/AdminEventsPage';

const mockedEventService = vi.hoisted(() => ({
  fetchAdminEvents: vi.fn(),
  createAdminEvent: vi.fn(),
  updateAdminEvent: vi.fn(),
  setAdminEventStatus: vi.fn(),
  replaceAdminEventMenuItems: vi.fn(),
  fetchAdminEventForecast: vi.fn(),
  generateAdminEventOrderDraft: vi.fn(),
}));

const mockedRoomPlanService = vi.hoisted(() => ({
  fetchRoomPlans: vi.fn(),
}));

const mockedOrderService = vi.hoisted(() => ({
  fetchPublishedDishes: vi.fn(),
}));

vi.mock('../../src/components/Admin/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../src/services/eventReservationService', () => ({
  fetchAdminEvents: mockedEventService.fetchAdminEvents,
  createAdminEvent: mockedEventService.createAdminEvent,
  updateAdminEvent: mockedEventService.updateAdminEvent,
  setAdminEventStatus: mockedEventService.setAdminEventStatus,
  replaceAdminEventMenuItems: mockedEventService.replaceAdminEventMenuItems,
  fetchAdminEventForecast: mockedEventService.fetchAdminEventForecast,
  generateAdminEventOrderDraft: mockedEventService.generateAdminEventOrderDraft,
}));

vi.mock('../../src/services/roomPlanService', () => ({
  fetchRoomPlans: mockedRoomPlanService.fetchRoomPlans,
}));

vi.mock('../../src/services/orderService', () => ({
  fetchPublishedDishes: mockedOrderService.fetchPublishedDishes,
}));

describe('AdminEventsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRoomPlanService.fetchRoomPlans.mockResolvedValue([{ id: 2, restaurant_id: 1, name: 'Main Hall', width: 1000, height: 800 }]);
    mockedOrderService.fetchPublishedDishes.mockResolvedValue([
      { id: 11, name: 'Mixed Grill', price: 14, category: 'Food' },
    ]);
    mockedEventService.fetchAdminEvents.mockResolvedValue([]);
    mockedEventService.createAdminEvent.mockResolvedValue({
      id: 50,
      restaurant_id: 1,
      room_plan_id: null,
      invoice_id: null,
      title: 'Corporate Night',
      customer_name: 'Rania',
      customer_phone: '+96170000001',
      customer_email: null,
      status: 'draft',
      notes: null,
      start_at: '2026-05-20T16:00:00.000000Z',
      end_at: '2026-05-20T19:00:00.000000Z',
      event_date: '2026-05-20',
      start_time: '19:00',
      end_time: '22:00',
      menu_items: [],
      linked_orders: [],
    });
  });

  it('creates a new event from form inputs', async () => {
    render(<AdminEventsPage />);

    await screen.findByText('Event Details');

    fireEvent.change(screen.getByPlaceholderText('Event title'), { target: { value: 'Corporate Night' } });
    fireEvent.change(screen.getByPlaceholderText('Customer name'), { target: { value: 'Rania' } });
    fireEvent.change(screen.getByPlaceholderText('Customer phone'), { target: { value: '+96170000001' } });
    fireEvent.change(screen.getByDisplayValue('19:00'), { target: { value: '18:30' } });
    fireEvent.change(screen.getByDisplayValue('22:00'), { target: { value: '23:30' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create Event' }));

    await waitFor(() => {
      expect(mockedEventService.createAdminEvent).toHaveBeenCalledTimes(1);
    });

    expect(mockedEventService.createAdminEvent).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Corporate Night',
      customer_name: 'Rania',
      customer_phone: '+96170000001',
      start_time: '18:30',
      end_time: '23:30',
    }));
  });
});

