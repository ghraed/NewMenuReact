export type BorderSamplePoint = {
  x: number;
  y: number;
  angle: number;
};

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const BORDER_KEYWORDS = /(wall|border|outline|perimeter|room|edge)/i;
const DEFAULT_SAMPLE_SPACING = 14;

type PlanSize = {
  width: number;
  height: number;
};

type ViewBox = {
  minX: number;
  minY: number;
  width: number;
  height: number;
};

const clampNumber = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const normalizeAngle = (angle: number): number => {
  if (!Number.isFinite(angle)) return 0;
  let normalized = angle % 360;
  if (normalized < 0) normalized += 360;
  return normalized;
};

const parseNumber = (value: string | null): number | null => {
  if (value == null || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const parseViewBox = (svg: SVGSVGElement, plan: PlanSize): ViewBox => {
  const raw = svg.getAttribute('viewBox');
  if (!raw) {
    return {
      minX: 0,
      minY: 0,
      width: plan.width,
      height: plan.height,
    };
  }

  const values = raw.split(/[\s,]+/).map((token) => Number(token)).filter(Number.isFinite);
  if (values.length !== 4) {
    return {
      minX: 0,
      minY: 0,
      width: plan.width,
      height: plan.height,
    };
  }

  const width = values[2] > 0 ? values[2] : plan.width;
  const height = values[3] > 0 ? values[3] : plan.height;

  return {
    minX: values[0],
    minY: values[1],
    width,
    height,
  };
};

const toPlanPoint = (point: { x: number; y: number }, viewBox: ViewBox, plan: PlanSize): { x: number; y: number } => ({
  x: ((point.x - viewBox.minX) / viewBox.width) * plan.width,
  y: ((point.y - viewBox.minY) / viewBox.height) * plan.height,
});

const distance = (left: { x: number; y: number }, right: { x: number; y: number }): number => (
  Math.hypot(left.x - right.x, left.y - right.y)
);

const addLinearSamples = (
  start: { x: number; y: number },
  end: { x: number; y: number },
  samples: BorderSamplePoint[],
  spacing = DEFAULT_SAMPLE_SPACING
) => {
  const segmentLength = distance(start, end);
  if (segmentLength <= 0.0001) return;

  const steps = Math.max(1, Math.ceil(segmentLength / spacing));
  const angle = normalizeAngle(Math.atan2(end.y - start.y, end.x - start.x) * (180 / Math.PI));

  for (let step = 0; step <= steps; step += 1) {
    const ratio = step / steps;
    samples.push({
      x: start.x + (end.x - start.x) * ratio,
      y: start.y + (end.y - start.y) * ratio,
      angle,
    });
  }
};

const addPathSamples = (
  pathData: string,
  samples: BorderSamplePoint[],
  mapPoint: (point: { x: number; y: number }) => { x: number; y: number },
  spacing = DEFAULT_SAMPLE_SPACING
) => {
  if (typeof document === 'undefined') return;

  const path = document.createElementNS(SVG_NAMESPACE, 'path');
  path.setAttribute('d', pathData);

  let totalLength = 0;
  try {
    totalLength = path.getTotalLength();
  } catch {
    return;
  }

  if (!Number.isFinite(totalLength) || totalLength <= 0.0001) return;

  const steps = Math.max(2, Math.ceil(totalLength / spacing));
  const delta = Math.min(2, totalLength / steps);

  for (let step = 0; step <= steps; step += 1) {
    const lengthAt = (step / steps) * totalLength;

    const current = path.getPointAtLength(lengthAt);
    const previous = path.getPointAtLength(Math.max(0, lengthAt - delta));
    const next = path.getPointAtLength(Math.min(totalLength, lengthAt + delta));

    const mapped = mapPoint({ x: current.x, y: current.y });
    const mappedPrevious = mapPoint({ x: previous.x, y: previous.y });
    const mappedNext = mapPoint({ x: next.x, y: next.y });

    samples.push({
      x: mapped.x,
      y: mapped.y,
      angle: normalizeAngle(Math.atan2(mappedNext.y - mappedPrevious.y, mappedNext.x - mappedPrevious.x) * (180 / Math.PI)),
    });
  }
};

const parsePolylinePoints = (raw: string | null): Array<{ x: number; y: number }> => {
  if (!raw) return [];
  const values = raw
    .trim()
    .split(/[\s,]+/)
    .map((token) => Number(token))
    .filter(Number.isFinite);

  const points: Array<{ x: number; y: number }> = [];
  for (let index = 0; index < values.length; index += 2) {
    const x = values[index];
    const y = values[index + 1];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    points.push({ x, y });
  }

  return points;
};

const elementHasBorderHint = (element: Element): boolean => {
  const fields = [
    element.getAttribute('id'),
    element.getAttribute('class'),
    element.getAttribute('data-name'),
    element.getAttribute('inkscape:label'),
    element.getAttribute('aria-label'),
    element.getAttribute('title'),
  ]
    .filter(Boolean)
    .join(' ');

  return BORDER_KEYWORDS.test(fields);
};

const elementLooksLikeStrokeShape = (element: SVGElement): boolean => {
  const fill = element.getAttribute('fill');
  const stroke = element.getAttribute('stroke');
  const style = element.getAttribute('style') ?? '';

  const styleHasStroke = /stroke\s*:/i.test(style);
  const styleHasNoFill = /fill\s*:\s*none/i.test(style);
  const fillNone = fill === 'none' || fill === 'transparent';

  return (Boolean(stroke) || styleHasStroke) && (fillNone || !fill || styleHasNoFill);
};

const dedupeSamples = (samples: BorderSamplePoint[]): BorderSamplePoint[] => {
  const seen = new Set<string>();
  const unique: BorderSamplePoint[] = [];

  for (const sample of samples) {
    const key = `${Math.round(sample.x * 10)}:${Math.round(sample.y * 10)}:${Math.round(sample.angle)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(sample);
  }

  return unique;
};

const sampleSvgElement = (
  element: SVGElement,
  samples: BorderSamplePoint[],
  mapPoint: (point: { x: number; y: number }) => { x: number; y: number }
) => {
  const tag = element.tagName.toLowerCase();

  if (tag === 'path') {
    const d = element.getAttribute('d');
    if (d) addPathSamples(d, samples, mapPoint);
    return;
  }

  if (tag === 'line') {
    const x1 = parseNumber(element.getAttribute('x1'));
    const y1 = parseNumber(element.getAttribute('y1'));
    const x2 = parseNumber(element.getAttribute('x2'));
    const y2 = parseNumber(element.getAttribute('y2'));

    if (x1 == null || y1 == null || x2 == null || y2 == null) return;
    addLinearSamples(mapPoint({ x: x1, y: y1 }), mapPoint({ x: x2, y: y2 }), samples);
    return;
  }

  if (tag === 'polyline' || tag === 'polygon') {
    const points = parsePolylinePoints(element.getAttribute('points'));
    if (points.length < 2) return;

    for (let index = 0; index < points.length - 1; index += 1) {
      addLinearSamples(mapPoint(points[index]), mapPoint(points[index + 1]), samples);
    }

    if (tag === 'polygon') {
      addLinearSamples(mapPoint(points.at(-1)!), mapPoint(points[0]), samples);
    }
    return;
  }

  if (tag === 'rect') {
    const x = parseNumber(element.getAttribute('x')) ?? 0;
    const y = parseNumber(element.getAttribute('y')) ?? 0;
    const width = parseNumber(element.getAttribute('width')) ?? 0;
    const height = parseNumber(element.getAttribute('height')) ?? 0;

    if (width <= 0 || height <= 0) return;

    const topLeft = mapPoint({ x, y });
    const topRight = mapPoint({ x: x + width, y });
    const bottomRight = mapPoint({ x: x + width, y: y + height });
    const bottomLeft = mapPoint({ x, y: y + height });

    addLinearSamples(topLeft, topRight, samples);
    addLinearSamples(topRight, bottomRight, samples);
    addLinearSamples(bottomRight, bottomLeft, samples);
    addLinearSamples(bottomLeft, topLeft, samples);
    return;
  }

  if (tag === 'circle' || tag === 'ellipse') {
    const cx = parseNumber(element.getAttribute('cx')) ?? 0;
    const cy = parseNumber(element.getAttribute('cy')) ?? 0;
    const rx = tag === 'circle'
      ? (parseNumber(element.getAttribute('r')) ?? 0)
      : (parseNumber(element.getAttribute('rx')) ?? 0);
    const ry = tag === 'circle'
      ? rx
      : (parseNumber(element.getAttribute('ry')) ?? 0);

    if (rx <= 0 || ry <= 0) return;

    const circumferenceEstimate = 2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2);
    const steps = Math.max(24, Math.ceil(circumferenceEstimate / DEFAULT_SAMPLE_SPACING));

    for (let step = 0; step <= steps; step += 1) {
      const t = (step / steps) * Math.PI * 2;
      const x = cx + rx * Math.cos(t);
      const y = cy + ry * Math.sin(t);

      const dx = -rx * Math.sin(t);
      const dy = ry * Math.cos(t);
      const nextPoint = mapPoint({ x: x + dx, y: y + dy });
      const previousPoint = mapPoint({ x: x - dx, y: y - dy });
      const mapped = mapPoint({ x, y });

      samples.push({
        x: mapped.x,
        y: mapped.y,
        angle: normalizeAngle(Math.atan2(nextPoint.y - previousPoint.y, nextPoint.x - previousPoint.x) * (180 / Math.PI)),
      });
    }
  }
};

export const sampleRectBorderPoints = (width: number, height: number, spacing = DEFAULT_SAMPLE_SPACING): BorderSamplePoint[] => {
  if (width <= 0 || height <= 0) return [];

  const points: BorderSamplePoint[] = [];
  addLinearSamples({ x: 0, y: 0 }, { x: width, y: 0 }, points, spacing);
  addLinearSamples({ x: width, y: 0 }, { x: width, y: height }, points, spacing);
  addLinearSamples({ x: width, y: height }, { x: 0, y: height }, points, spacing);
  addLinearSamples({ x: 0, y: height }, { x: 0, y: 0 }, points, spacing);
  return dedupeSamples(points).map((point) => ({
    ...point,
    x: clampNumber(point.x, 0, width),
    y: clampNumber(point.y, 0, height),
  }));
};

export const extractBorderPointsFromSvg = (
  svgText: string,
  plan: PlanSize
): BorderSamplePoint[] => {
  if (typeof DOMParser === 'undefined') return [];

  const parser = new DOMParser();
  const documentNode = parser.parseFromString(svgText, 'image/svg+xml');
  const svg = documentNode.querySelector('svg');
  if (!svg) return [];

  const viewBox = parseViewBox(svg, plan);
  const mapPoint = (point: { x: number; y: number }) => toPlanPoint(point, viewBox, plan);

  const allShapes = Array.from(svg.querySelectorAll<SVGElement>('path,line,polyline,polygon,rect,circle,ellipse'));
  if (!allShapes.length) return [];

  const preferredShapes = allShapes.filter((shape) => elementHasBorderHint(shape) || elementLooksLikeStrokeShape(shape));
  const shapesToUse = preferredShapes.length > 0 ? preferredShapes : allShapes;

  const samples: BorderSamplePoint[] = [];
  for (const shape of shapesToUse) {
    sampleSvgElement(shape, samples, mapPoint);
  }

  return dedupeSamples(samples).filter((point) => (
    Number.isFinite(point.x)
    && Number.isFinite(point.y)
    && Number.isFinite(point.angle)
  ));
};

export const loadBorderPointsFromPlan = async (
  backgroundImageUrl: string | null | undefined,
  plan: PlanSize
): Promise<BorderSamplePoint[]> => {
  if (!backgroundImageUrl) return [];

  try {
    const response = await fetch(backgroundImageUrl, { cache: 'force-cache' });
    if (!response.ok) return [];

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('svg')) {
      const text = await response.text();
      if (!text.includes('<svg')) return [];
      return extractBorderPointsFromSvg(text, plan);
    }

    const text = await response.text();
    return extractBorderPointsFromSvg(text, plan);
  } catch {
    return [];
  }
};
