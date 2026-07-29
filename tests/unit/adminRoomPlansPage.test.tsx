import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminRoomPlansPage from '../../src/pages/AdminRoomPlansPage';
import type { RoomPlan, RoomPlanItem } from '../../src/types';

const mockedRoomPlanService = vi.hoisted(() => ({
  createRoomPlan: vi.fn(),
  deleteRoomPlan: vi.fn(),
  fetchRoomPlan: vi.fn(),
  fetchRoomPlans: vi.fn(),
  saveRoomPlanItemsBulk: vi.fn(),
  updateRoomPlan: vi.fn(),
  uploadRoomPlanBackground: vi.fn(),
}));

const mockedToast = vi.hoisted(() => ({
  showToast: vi.fn(),
  dismiss: vi.fn(),
}));

const mockedI18n = vi.hoisted(() => ({
  t: (key: string) => key,
}));

vi.mock('../../src/components/Admin/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../src/components/ui/liquid-glass', () => ({
  GlassToast: () => null,
  useGlassToast: () => ({ toast: null, showToast: mockedToast.showToast, dismiss: mockedToast.dismiss }),
}));

vi.mock('../../src/services/roomPlanService', () => ({
  createRoomPlan: mockedRoomPlanService.createRoomPlan,
  deleteRoomPlan: mockedRoomPlanService.deleteRoomPlan,
  fetchRoomPlan: mockedRoomPlanService.fetchRoomPlan,
  fetchRoomPlans: mockedRoomPlanService.fetchRoomPlans,
  saveRoomPlanItemsBulk: mockedRoomPlanService.saveRoomPlanItemsBulk,
  updateRoomPlan: mockedRoomPlanService.updateRoomPlan,
  uploadRoomPlanBackground: mockedRoomPlanService.uploadRoomPlanBackground,
}));

vi.mock('../../src/services/api', () => ({
  resolveAssetUrl: vi.fn(() => null),
}));

vi.mock('../../src/utils/roomPlanEdgeOverlay', () => ({
  buildSnapPoints: vi.fn(() => []),
  clearBorderOverlay: vi.fn(),
  detectEdges: vi.fn(() => []),
  drawContourPreview: vi.fn(),
  drawBorder: vi.fn(),
  findContours: vi.fn(() => []),
  loadBorderPoints: vi.fn(),
  pickContourByPoint: vi.fn(() => null),
  simplifyPath: vi.fn((points) => points),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockedI18n.t,
  }),
}));

const makePlan = (id: number, name: string): RoomPlan => ({
  id,
  restaurant_id: 1,
  name,
  width: 900,
  height: 700,
  items_count: 0,
});

const makeTable = (id: number, label: string): RoomPlanItem => ({
  id,
  room_plan_id: 11,
  type: 'table',
  label,
  x: 40,
  y: 40,
  width: 120,
  height: 120,
  rotation: 0,
  seats: 4,
  z_index: 1,
  container: 'room',
  is_active: true,
});

describe('AdminRoomPlansPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const plans = [
      makePlan(11, 'Main Room'),
      makePlan(22, 'Patio'),
    ];

    let persistedItems = [makeTable(501, 'Existing Table')];

    mockedRoomPlanService.fetchRoomPlans.mockResolvedValue(plans);
    mockedRoomPlanService.fetchRoomPlan.mockImplementation(async (roomPlanId: number) => {
      if (roomPlanId === 11) {
        return {
          ...plans[0],
          items: persistedItems,
        };
      }

      return {
        ...plans[1],
        items: [],
      };
    });

    mockedRoomPlanService.saveRoomPlanItemsBulk.mockImplementation(async (_roomPlanId: number, items: RoomPlanItem[]) => {
      persistedItems = items.map((item, index) => ({
        ...item,
        id: item.id > 0 ? item.id : 900 + index,
      }));

      return persistedItems;
    });
  });

  it('saves a room layout and reloads the persisted plan state when reopened', async () => {
    const { unmount } = render(<AdminRoomPlansPage />);

    await waitFor(() => {
      expect(mockedRoomPlanService.fetchRoomPlan).toHaveBeenCalledWith(11);
    });
    expect(await screen.findByRole('button', { name: /Existing Table/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'roomPlansPage.addItem' }));

    const labelInput = await screen.findByDisplayValue('roomPlansPage.itemTypes.table 2');
    fireEvent.change(labelInput, { target: { value: 'Window Seat 8' } });

    fireEvent.click(screen.getByRole('button', { name: 'roomPlansPage.saveLayout' }));

    await waitFor(() => {
      expect(mockedRoomPlanService.saveRoomPlanItemsBulk).toHaveBeenCalledTimes(1);
    });

    expect(mockedRoomPlanService.saveRoomPlanItemsBulk.mock.calls[0][1]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Window Seat 8' }),
      ])
    );

    fireEvent.click(screen.getByRole('button', { name: /Patio/ }));
    await waitFor(() => {
      expect(mockedRoomPlanService.fetchRoomPlan).toHaveBeenCalledWith(22);
    });

    fireEvent.click(screen.getByRole('button', { name: /Main Room/ }));

    await waitFor(() => {
      expect(mockedRoomPlanService.fetchRoomPlan).toHaveBeenCalledTimes(3);
    });
    expect(await screen.findByRole('button', { name: /Window Seat 8/i })).toBeInTheDocument();

    unmount();
  });
});
