import { describe, expect, it } from 'vitest';
import { extractBorderPointsFromSvg } from '../../src/utils/roomPlanGeometry';

describe('room plan geometry contour extraction', () => {
  it('selects the largest closed interior contour over outer frame', () => {
    const svg = `
      <svg viewBox="0 0 1000 800" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="1000" height="800" fill="none" stroke="#111" />
        <ellipse cx="500" cy="400" rx="350" ry="220" fill="none" stroke="#111" />
      </svg>
    `;

    const result = extractBorderPointsFromSvg(svg, { width: 1000, height: 800 });

    expect(result.source).toBe('svg-contour');
    expect(result.points.length).toBeGreaterThan(20);
    expect(result.points.every((point) => point.x > 10 && point.x < 990)).toBe(true);
    expect(result.points.every((point) => point.y > 10 && point.y < 790)).toBe(true);
  });

  it('produces tangent angle changes on curved contour segments', () => {
    const svg = `
      <svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="200" cy="150" rx="140" ry="90" fill="none" stroke="#111"/>
      </svg>
    `;

    const result = extractBorderPointsFromSvg(svg, { width: 400, height: 300 });
    const uniqueAngles = new Set(result.points.map((point) => Math.round(point.angle)));

    expect(result.source).toBe('svg-contour');
    expect(uniqueAngles.size).toBeGreaterThan(6);
  });

  it('falls back to generic stroke sampling when no closed contour exists', () => {
    const svg = `
      <svg viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
        <line x1="10" y1="10" x2="490" y2="490" stroke="#111" />
        <polyline points="40,250 120,200 200,250 280,200 360,250" fill="none" stroke="#111" />
      </svg>
    `;

    const result = extractBorderPointsFromSvg(svg, { width: 500, height: 500 });

    expect(result.source).toBe('svg-generic');
    expect(result.warning).toContain('closed room contour');
    expect(result.points.length).toBeGreaterThan(0);
  });
});
