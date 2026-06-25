import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminEventsPage from '../../src/pages/AdminEventsPage';

const mockedEventService = vi.hoisted(() => ({
  fetchAdminEvents: vi.fn(),
  createAdminEvent: vi.fn(),
  updateAdminEvent: vi.fn(),
  setAdminEventStatus: vi.fn(),
  fetchAdminEventDishOptions: vi.fn(),
  replaceAdminEventMenuItems: vi.fn(),
  fetchAdminEventForecast: vi.fn(),
  generateAdminEventOrderDraft: vi.fn(),
}));

const mockedRoomPlanService = vi.hoisted(() => ({
  fetchRoomPlans: vi.fn(),
}));

const mockedAuth = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

const mockedRealtime = vi.hoisted(() => ({
  getEcho: vi.fn(),
}));

vi.mock('../../src/components/Admin/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../src/contexts/useAuth', () => ({
  useAuth: mockedAuth.useAuth,
}));

vi.mock('../../src/services/realtime', () => ({
  getEcho: mockedRealtime.getEcho,
}));

vi.mock('../../src/services/eventReservationService', () => ({
  fetchAdminEvents: mockedEventService.fetchAdminEvents,
  createAdminEvent: mockedEventService.createAdminEvent,
  updateAdminEvent: mockedEventService.updateAdminEvent,
  setAdminEventStatus: mockedEventService.setAdminEventStatus,
  fetchAdminEventDishOptions: mockedEventService.fetchAdminEventDishOptions,
  replaceAdminEventMenuItems: mockedEventService.replaceAdminEventMenuItems,
  fetchAdminEventForecast: mockedEventService.fetchAdminEventForecast,
  generateAdminEventOrderDraft: mockedEventService.generateAdminEventOrderDraft,
}));

vi.mock('../../src/services/roomPlanService', () => ({
  fetchRoomPlans: mockedRoomPlanService.fetchRoomPlans,
}));

describe('AdminEventsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAuth.useAuth.mockReturnValue({
      user: {
        restaurant: {
          id: 1,
        },
      },
    });
    mockedRealtime.getEcho.mockReturnValue(null);
    mockedRoomPlanService.fetchRoomPlans.mockResolvedValue([{ id: 2, restaurant_id: 1, name: 'Main Hall', width: 1000, height: 800 }]);
    mockedEventService.fetchAdminEventDishOptions.mockResolvedValue([
      { id: 11, name: 'Mixed Grill', price: 14, category: 'Main' },
      { id: 12, name: 'Caesar Salad', price: 9, category: 'Salad' },
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
    mockedEventService.replaceAdminEventMenuItems.mockResolvedValue({
      id: 10,
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
      menu_items: [{ dish_id: 11, dish_name: 'Mixed Grill', planned_quantity: 3, prep_notes: 'Less salt' }],
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

  it('saves planned menu using only restaurant dish options', async () => {
    mockedEventService.fetchAdminEvents.mockResolvedValue([
      {
        id: 10,
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
        menu_items: [
          { dish_id: 11, dish_name: 'Mixed Grill', category: 'Main', planned_quantity: 3, prep_notes: 'Less salt' },
          { dish_id: 999, dish_name: 'Foreign Dish', planned_quantity: 4, prep_notes: 'Should be filtered' },
        ],
        linked_orders: [],
      },
    ]);

    render(<AdminEventsPage />);

    await screen.findByText('Planned Menu Quantities');
    await screen.findByDisplayValue('Less salt');
    expect(screen.queryByText('Foreign Dish')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save Planned Menu' }));

    await waitFor(() => {
      expect(mockedEventService.replaceAdminEventMenuItems).toHaveBeenCalledTimes(1);
    });

    expect(mockedEventService.replaceAdminEventMenuItems).toHaveBeenCalledWith(10, [
      { dish_id: 11, planned_quantity: 3, prep_notes: 'Less salt' },
    ]);
  });

  it('lets the user add a dish from search and set its quantity inside the category group', async () => {
    mockedEventService.fetchAdminEvents.mockResolvedValue([
      {
        id: 10,
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
      },
    ]);

    render(<AdminEventsPage />);

    await screen.findByText('Planned Menu Quantities');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Search dishes to add/i })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /Search dishes to add/i }));
    fireEvent.click(screen.getByRole('button', { name: /Caesar Salad · Salad/i }));

    expect(await screen.findByText('Salad')).toBeInTheDocument();
    expect(await screen.findByText('Caesar Salad')).toBeInTheDocument();

    const quantityInputs = screen.getAllByDisplayValue('1');
    fireEvent.change(quantityInputs[0], { target: { value: '5' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save Planned Menu' }));

    await waitFor(() => {
      expect(mockedEventService.replaceAdminEventMenuItems).toHaveBeenCalledWith(10, [
        { dish_id: 12, planned_quantity: 5, prep_notes: null },
      ]);
    });
  });
});
