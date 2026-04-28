import { describe, expect, it } from 'vitest';
import type { RoomPlanItem } from '../../src/types';
import { sampleRectBorderPoints } from '../../src/utils/roomPlanGeometry';
import { findNearestBorderPoint, snapWindowItemToBorder, snapWindowUsingCurrentPosition } from '../../src/utils/roomPlanWindowSnap';

const baseWindow = (): RoomPlanItem => ({
  id: 1,
  room_plan_id: 1,
  type: 'window',
  label: 'Window 1',
  x: 0,
  y: 0,
  width: 160,
  height: 40,
  rotation: 0,
  seats: null,
  z_index: 1,
  container: 'room',
  is_active: true,
});

describe('room plan window snapping', () => {
  it('samples rectangle border points with tangent angles', () => {
    const points = sampleRectBorderPoints(300, 200, 50);

    expect(points.length).toBeGreaterThan(0);
    expect(points.some((point) => Math.abs(point.y) < 0.001 && Math.abs(point.angle) < 0.001)).toBe(true);
    expect(points.some((point) => Math.abs(point.x - 300) < 0.001 && Math.abs(point.angle - 90) < 0.001)).toBe(true);
  });

  it('snaps a window to top border and applies tangent rotation', () => {
    const borders = sampleRectBorderPoints(1000, 700);
    const item = {
      ...baseWindow(),
      x: 400,
      y: 20,
    };

    const snapped = snapWindowUsingCurrentPosition(item, borders, 1000, 700);

    expect(snapped.item.container).toBe('wrapper');
    expect(snapped.item.rotation).toBeCloseTo(0, 1);
    expect(snapped.item.y).toBeCloseTo(0, 1);
  });

  it('snaps to right border and rotates to vertical tangent during drag', () => {
    const borders = sampleRectBorderPoints(1000, 700);
    const item = {
      ...baseWindow(),
      x: 600,
      y: 300,
    };

    const snapped = snapWindowItemToBorder(item, borders, 1000, 700, { x: 998, y: 300 });

    expect(snapped.item.rotation).toBeCloseTo(90, 1);
    expect(snapped.item.x).toBeCloseTo(900, 1);
  });

  it('uses preferred index stickiness to reduce drag jitter', () => {
    const points = [
      { x: 0, y: 0, angle: 0 },
      { x: 10, y: 0, angle: 0 },
    ];

    const nearest = findNearestBorderPoint({ x: 5.1, y: 0 }, points, 0, 1);
    expect(nearest?.index).toBe(0);
  });

  it('falls back to clamped behavior when no border points are available', () => {
    const snapped = snapWindowItemToBorder(
      {
        ...baseWindow(),
        x: -50,
        y: -10,
      },
      [],
      500,
      300,
      { x: 10, y: 10 }
    );

    expect(snapped.snapIndex).toBe(-1);
    expect(snapped.item.x).toBe(0);
    expect(snapped.item.y).toBe(0);
    expect(snapped.item.container).toBe('wrapper');
  });
});

