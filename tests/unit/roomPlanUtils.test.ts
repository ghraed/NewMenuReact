import { describe, expect, it } from 'vitest';
import { clampRoomPlanItem, roomPlanStatusColor, toTimeSlots } from '../../src/utils/roomPlan';
import type { RoomPlanItem } from '../../src/types';

describe('room plan utils', () => {
  it('clamps item coordinates and dimensions inside room bounds', () => {
    const item: RoomPlanItem = {
      id: 1,
      room_plan_id: 1,
      type: 'table',
      label: 'T1',
      x: 980,
      y: -20,
      width: 300,
      height: 120,
      rotation: 0,
      seats: 4,
      z_index: 1,
      container: 'room',
      is_active: true,
    };

    const clamped = clampRoomPlanItem(item, 1000, 700);

    expect(clamped.x).toBe(700);
    expect(clamped.y).toBe(0);
    expect(clamped.width).toBe(300);
    expect(clamped.height).toBe(120);
  });

  it('returns visual colors by availability status', () => {
    expect(roomPlanStatusColor('free')).toBe('#22c55e');
    expect(roomPlanStatusColor('reserved')).toBe('#f59e0b');
    expect(roomPlanStatusColor('busy')).toBe('#ef4444');
    expect(roomPlanStatusColor('no_show')).toBe('#94a3b8');
  });

  it('creates 15-minute time slots', () => {
    const slots = toTimeSlots(15);

    expect(slots[0]).toBe('00:00');
    expect(slots[1]).toBe('00:15');
    expect(slots.at(-1)).toBe('23:45');
    expect(slots).toHaveLength(96);
  });
});
