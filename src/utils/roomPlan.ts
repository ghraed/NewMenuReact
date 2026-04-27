import type { ReservationVisualStatus, RoomPlanItem, RoomPlanItemType } from '../types';

export const ROOM_PLAN_ITEM_GROUPS: Array<{ label: string; options: Array<{ value: RoomPlanItemType; label: string }> }> = [
  {
    label: 'Tables',
    options: [{ value: 'table', label: 'Table' }],
  },
  {
    label: 'Structure',
    options: [
      { value: 'window', label: 'Window' },
      { value: 'counter', label: 'Counter' },
      { value: 'bar', label: 'Bar' },
      { value: 'kitchen', label: 'Kitchen' },
      { value: 'cashier', label: 'Cashier' },
      { value: 'wc', label: 'WC' },
    ],
  },
  {
    label: 'Furniture',
    options: [
      { value: 'fridge', label: 'Fridge' },
      { value: 'sofa', label: 'Sofa' },
      { value: 'plant', label: 'Plant' },
    ],
  },
];

export const clampRoomPlanItem = (
  item: RoomPlanItem,
  planWidth: number,
  planHeight: number
): RoomPlanItem => {
  const width = Math.max(10, Math.min(item.width, planWidth));
  const height = Math.max(10, Math.min(item.height, planHeight));
  const x = Math.max(0, Math.min(item.x, Math.max(0, planWidth - width)));
  const y = Math.max(0, Math.min(item.y, Math.max(0, planHeight - height)));

  return {
    ...item,
    width,
    height,
    x,
    y,
  };
};

export const roomPlanStatusColor = (status: ReservationVisualStatus): string => {
  switch (status) {
    case 'busy':
      return '#ef4444';
    case 'reserved':
      return '#f59e0b';
    case 'no_show':
      return '#94a3b8';
    default:
      return '#22c55e';
  }
};

export const toTimeSlots = (stepMinutes = 15): string[] => {
  const slots: string[] = [];
  const safeStep = Math.max(1, stepMinutes);

  for (let minute = 0; minute < 24 * 60; minute += safeStep) {
    const hours = Math.floor(minute / 60).toString().padStart(2, '0');
    const mins = (minute % 60).toString().padStart(2, '0');
    slots.push(`${hours}:${mins}`);
  }

  return slots;
};

export const nextZIndex = (items: RoomPlanItem[]): number => {
  if (!items.length) {
    return 1;
  }

  return Math.max(...items.map((item) => item.z_index || 0)) + 1;
};
