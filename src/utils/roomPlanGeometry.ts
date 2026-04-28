export type BorderSamplePoint = {
  x: number;
  y: number;
  angle: number;
};

export type BorderPointsLoadResult = {
  points: BorderSamplePoint[];
  source: 'svg-contour' | 'svg-generic' | 'rect-fallback' | 'none';
  warning?: string;
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

type Point2D = {
  x: number;
  y: number;
};

type ContourCandidate = {
  points: Point2D[];
  closed: boolean;
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

const distance = (left: Point2D, right: Point2D): number => Math.hypot(left.x - right.x, left.y - right.y);

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

const toPlanPoint = (point: Point2D, viewBox: ViewBox, plan: PlanSize): Point2D => ({
  x: ((point.x - viewBox.minX) / viewBox.width) * plan.width,
  y: ((point.y - viewBox.minY) / viewBox.height) * plan.height,
});

const parsePolylinePoints = (raw: string | null): Point2D[] => {
  if (!raw) return [];
  const values = raw
    .trim()
    .split(/[\s,]+/)
    .map((token) => Number(token))
    .filter(Number.isFinite);

  const points: Point2D[] = [];
  for (let index = 0; index < values.length; index += 2) {
    const x = values[index];
    const y = values[index + 1];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    points.push({ x, y });
  }

  return points;
};

const dedupeContourPoints = (points: Point2D[]): Point2D[] => {
  const seen = new Set<string>();
  const unique: Point2D[] = [];

  for (const point of points) {
    const key = `${Math.round(point.x * 100)}:${Math.round(point.y * 100)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(point);
  }

  return unique;
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

const samplePathPoints = (d: string, spacing = DEFAULT_SAMPLE_SPACING): Point2D[] => {
  if (typeof document === 'undefined') return [];
  const path = document.createElementNS(SVG_NAMESPACE, 'path');
  path.setAttribute('d', d);

  let totalLength = 0;
  try {
    totalLength = path.getTotalLength();
  } catch {
    return [];
  }

  if (!Number.isFinite(totalLength) || totalLength <= 0.0001) return [];

  const steps = Math.max(4, Math.ceil(totalLength / spacing));
  const points: Point2D[] = [];

  for (let step = 0; step <= steps; step += 1) {
    const at = (step / steps) * totalLength;
    const p = path.getPointAtLength(at);
    points.push({ x: p.x, y: p.y });
  }

  return dedupeContourPoints(points);
};

const buildContourCandidate = (element: SVGElement): ContourCandidate | null => {
  const tag = element.tagName.toLowerCase();

  if (tag === 'path') {
    const d = element.getAttribute('d');
    if (!d) return null;
    const points = samplePathPoints(d);
    if (points.length < 2) return null;
    const explicitClose = /[zZ]/.test(d);
    const tolerance = DEFAULT_SAMPLE_SPACING * 1.6;
    const closedByDistance = distance(points[0], points[points.length - 1]) <= tolerance;
    return { points, closed: explicitClose || closedByDistance };
  }

  if (tag === 'line') {
    const x1 = parseNumber(element.getAttribute('x1'));
    const y1 = parseNumber(element.getAttribute('y1'));
    const x2 = parseNumber(element.getAttribute('x2'));
    const y2 = parseNumber(element.getAttribute('y2'));
    if (x1 == null || y1 == null || x2 == null || y2 == null) return null;
    return { points: [{ x: x1, y: y1 }, { x: x2, y: y2 }], closed: false };
  }

  if (tag === 'polyline' || tag === 'polygon') {
    const points = parsePolylinePoints(element.getAttribute('points'));
    if (points.length < 2) return null;
    const closed = tag === 'polygon' || distance(points[0], points[points.length - 1]) <= DEFAULT_SAMPLE_SPACING;
    return { points, closed };
  }

  if (tag === 'rect') {
    const x = parseNumber(element.getAttribute('x')) ?? 0;
    const y = parseNumber(element.getAttribute('y')) ?? 0;
    const width = parseNumber(element.getAttribute('width')) ?? 0;
    const height = parseNumber(element.getAttribute('height')) ?? 0;
    if (width <= 0 || height <= 0) return null;

    return {
      points: [
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height },
      ],
      closed: true,
    };
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
    if (rx <= 0 || ry <= 0) return null;

    const circumferenceEstimate = 2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2);
    const steps = Math.max(24, Math.ceil(circumferenceEstimate / DEFAULT_SAMPLE_SPACING));
    const points: Point2D[] = [];
    for (let step = 0; step < steps; step += 1) {
      const t = (step / steps) * Math.PI * 2;
      points.push({
        x: cx + rx * Math.cos(t),
        y: cy + ry * Math.sin(t),
      });
    }
    return { points, closed: true };
  }

  return null;
};

const contourArea = (points: Point2D[]): number => {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    sum += (current.x * next.y) - (next.x * current.y);
  }
  return Math.abs(sum) / 2;
};

const contourTouchesPlanEdges = (points: Point2D[], plan: PlanSize): boolean => {
  const xTolerance = Math.max(8, plan.width * 0.02);
  const yTolerance = Math.max(8, plan.height * 0.02);

  return points.some((point) => (
    point.x <= xTolerance
    || point.y <= yTolerance
    || point.x >= plan.width - xTolerance
    || point.y >= plan.height - yTolerance
  ));
};

const contourToSamplePoints = (points: Point2D[], closed: boolean): BorderSamplePoint[] => {
  if (points.length < 2) return [];
  const samples: BorderSamplePoint[] = [];
  const lastIndex = points.length - 1;

  for (let index = 0; index < points.length; index += 1) {
    const previousIndex = index === 0 ? (closed ? lastIndex : 0) : index - 1;
    const nextIndex = index === lastIndex ? (closed ? 0 : lastIndex) : index + 1;
    const previous = points[previousIndex];
    const current = points[index];
    const next = points[nextIndex];
    const angle = normalizeAngle(Math.atan2(next.y - previous.y, next.x - previous.x) * (180 / Math.PI));

    samples.push({
      x: current.x,
      y: current.y,
      angle,
    });
  }

  return dedupeSamples(samples);
};

const buildGenericSamplesFromSvg = (
  allShapes: SVGElement[],
  mapPoint: (point: Point2D) => Point2D
): BorderSamplePoint[] => {
  const samples: BorderSamplePoint[] = [];

  for (const shape of allShapes) {
    const candidate = buildContourCandidate(shape);
    if (!candidate) continue;
    const mappedPoints = candidate.points.map(mapPoint);
    samples.push(...contourToSamplePoints(mappedPoints, candidate.closed));
  }

  return dedupeSamples(samples);
};

export const sampleRectBorderPoints = (width: number, height: number, spacing = DEFAULT_SAMPLE_SPACING): BorderSamplePoint[] => {
  if (width <= 0 || height <= 0) return [];
  const step = Math.max(6, spacing);
  const points: Point2D[] = [];

  for (let x = 0; x <= width; x += step) points.push({ x, y: 0 });
  for (let y = 0; y <= height; y += step) points.push({ x: width, y });
  for (let x = width; x >= 0; x -= step) points.push({ x, y: height });
  for (let y = height; y >= 0; y -= step) points.push({ x: 0, y });

  return contourToSamplePoints(points, true).map((point) => ({
    ...point,
    x: clampNumber(point.x, 0, width),
    y: clampNumber(point.y, 0, height),
  }));
};

export const extractBorderPointsFromSvg = (
  svgText: string,
  plan: PlanSize
): BorderPointsLoadResult => {
  if (typeof DOMParser === 'undefined') return { points: [], source: 'none' };

  const parser = new DOMParser();
  const documentNode = parser.parseFromString(svgText, 'image/svg+xml');
  const svg = documentNode.querySelector('svg');
  if (!svg) return { points: [], source: 'none' };

  const viewBox = parseViewBox(svg, plan);
  const mapPoint = (point: Point2D): Point2D => toPlanPoint(point, viewBox, plan);

  const allShapes = Array.from(svg.querySelectorAll<SVGElement>('path,line,polyline,polygon,rect,circle,ellipse'));
  if (!allShapes.length) return { points: [], source: 'none' };

  const preferredShapes = allShapes.filter((shape) => elementHasBorderHint(shape) || elementLooksLikeStrokeShape(shape));
  const shapesToUse = preferredShapes.length > 0 ? preferredShapes : allShapes;

  const closedContours = shapesToUse
    .map((shape) => buildContourCandidate(shape))
    .filter((candidate): candidate is ContourCandidate => Boolean(candidate && candidate.closed && candidate.points.length >= 4))
    .map((candidate) => ({
      ...candidate,
      points: candidate.points.map(mapPoint),
    }));

  const interiorContours = closedContours.filter((candidate) => !contourTouchesPlanEdges(candidate.points, plan));
  const contoursForSelection = interiorContours.length > 0 ? interiorContours : closedContours;

  if (contoursForSelection.length > 0) {
    const largest = contoursForSelection.reduce((best, current) => (
      contourArea(current.points) > contourArea(best.points) ? current : best
    ));

    const points = contourToSamplePoints(largest.points, true);
    if (points.length > 0) {
      return {
        points,
        source: 'svg-contour',
      };
    }
  }

  const genericSamples = buildGenericSamplesFromSvg(shapesToUse, mapPoint);
  if (genericSamples.length > 0) {
    return {
      points: genericSamples,
      source: 'svg-generic',
      warning: 'Could not detect a closed room contour in SVG. Using generic wall strokes instead.',
    };
  }

  return { points: [], source: 'none' };
};

export const loadBorderPointsFromPlan = async (
  backgroundImageUrl: string | null | undefined,
  plan: PlanSize
): Promise<BorderPointsLoadResult> => {
  if (!backgroundImageUrl) return { points: [], source: 'none' };

  try {
    const response = await fetch(backgroundImageUrl, { cache: 'force-cache' });
    if (!response.ok) return { points: [], source: 'none' };

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('svg')) {
      const text = await response.text();
      if (!text.includes('<svg')) return { points: [], source: 'none' };
      return extractBorderPointsFromSvg(text, plan);
    }

    const text = await response.text();
    return extractBorderPointsFromSvg(text, plan);
  } catch {
    return { points: [], source: 'none' };
  }
};

