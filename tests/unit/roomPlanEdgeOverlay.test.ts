import { describe, expect, it } from 'vitest';
import { buildSnapPoints, detectEdges, toSnapBorderPoints } from '../../src/utils/roomPlanEdgeOverlay';

describe('room plan edge overlay utils', () => {
  it('detects pixel edges using right and bottom differences', () => {
    const width = 3;
    const height = 3;
    const raw = new Uint8ClampedArray(width * height * 4);

    for (let i = 0; i < width * height; i += 1) {
      const base = i * 4;
      raw[base] = 20;
      raw[base + 1] = 20;
      raw[base + 2] = 20;
      raw[base + 3] = 255;
    }

    const center = (1 * width) + 1;
    raw[center * 4] = 250;
    raw[center * 4 + 1] = 250;
    raw[center * 4 + 2] = 250;

    const imageData = { data: raw, width, height } as ImageData;
    const edges = detectEdges(imageData, 40);

    expect(edges.data.some((value) => value > 0)).toBe(true);
  });

  it('converts border points into snap points with tangents', () => {
    const snapPoints = toSnapBorderPoints([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ]);

    expect(snapPoints.length).toBe(4);
    expect(snapPoints[0].angle).toBeGreaterThanOrEqual(0);
    expect(snapPoints[0].angle).toBeLessThan(360);
  });

  it('builds dense snap points for segments', () => {
    const snapPoints = buildSnapPoints([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
    ], 5);

    expect(snapPoints.length).toBeGreaterThan(20);
    expect(snapPoints[0].angle).toBeGreaterThanOrEqual(0);
  });

  it('parses JSON content with BOM marker', () => {
    const raw = '\uFEFF[{"x":1,"y":2},{"x":3,"y":4},{"x":5,"y":6}]';
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, '').trim()) as Array<{ x: number; y: number }>;
    expect(parsed.length).toBe(3);
  });
});
