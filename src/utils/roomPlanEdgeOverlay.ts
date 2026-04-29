export type BorderGuidePoint = {
  x: number;
  y: number;
};

export type EdgeMask = {
  width: number;
  height: number;
  data: Uint8Array;
};

export type DetectedContour = {
  id: string;
  points: BorderGuidePoint[];
  pixelCount: number;
  perimeter: number;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const getLuma = (rgba: Uint8ClampedArray, pixelIndex: number): number => {
  const offset = pixelIndex * 4;
  const r = rgba[offset];
  const g = rgba[offset + 1];
  const b = rgba[offset + 2];
  return (0.299 * r) + (0.587 * g) + (0.114 * b);
};

export const detectEdges = (imageData: ImageData, threshold: number): EdgeMask => {
  const { width, height, data: rgba } = imageData;
  const edgeMask = new Uint8Array(width * height);
  const safeThreshold = clamp(Math.round(threshold), 1, 255);

  for (let y = 0; y < height - 1; y += 1) {
    const rowOffset = y * width;
    for (let x = 0; x < width - 1; x += 1) {
      const index = rowOffset + x;
      const rightIndex = index + 1;
      const bottomIndex = index + width;

      const center = getLuma(rgba, index);
      const right = getLuma(rgba, rightIndex);
      const bottom = getLuma(rgba, bottomIndex);

      const delta = Math.max(Math.abs(center - right), Math.abs(center - bottom));
      if (delta >= safeThreshold) {
        edgeMask[index] = 255;
      }
    }
  }

  return {
    width,
    height,
    data: edgeMask,
  };
};

const NEIGHBORS_8: Array<[dx: number, dy: number]> = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0],           [1, 0],
  [-1, 1],  [0, 1],  [1, 1],
];

const inBounds = (x: number, y: number, width: number, height: number): boolean => (
  x >= 0 && y >= 0 && x < width && y < height
);

const pointKey = (x: number, y: number): string => `${x}:${y}`;

const approximatePerimeter = (points: BorderGuidePoint[]): number => {
  if (points.length < 2) return 0;
  let length = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    length += Math.hypot(a.x - b.x, a.y - b.y);
  }
  return length;
};

const componentToBoundary = (
  componentPixels: BorderGuidePoint[],
  componentSet: Set<string>
): BorderGuidePoint[] => {
  const boundary = componentPixels.filter((point) => {
    for (const [dx, dy] of NEIGHBORS_8) {
      const nx = point.x + dx;
      const ny = point.y + dy;
      if (!componentSet.has(pointKey(nx, ny))) {
        return true;
      }
    }
    return false;
  });

  if (boundary.length <= 2) return boundary;

  // Order boundary points by walking nearest unvisited neighbor.
  const unvisited = new Map<string, BorderGuidePoint>();
  for (const point of boundary) {
    unvisited.set(pointKey(point.x, point.y), point);
  }

  const start = boundary.reduce((best, point) => (
    point.y < best.y || (point.y === best.y && point.x < best.x) ? point : best
  ));

  const ordered: BorderGuidePoint[] = [];
  let current: BorderGuidePoint | undefined = start;
  const neighborRadius = 2;

  while (current) {
    ordered.push(current);
    unvisited.delete(pointKey(current.x, current.y));
    if (unvisited.size === 0) break;

    let next: BorderGuidePoint | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let dy = -neighborRadius; dy <= neighborRadius; dy += 1) {
      for (let dx = -neighborRadius; dx <= neighborRadius; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const candidate = unvisited.get(pointKey(current.x + dx, current.y + dy));
        if (!candidate) continue;
        const d = Math.hypot(candidate.x - current.x, candidate.y - current.y);
        if (d < bestDistance) {
          bestDistance = d;
          next = candidate;
        }
      }
    }

    if (!next) {
      for (const candidate of unvisited.values()) {
        const d = Math.hypot(candidate.x - current.x, candidate.y - current.y);
        if (d < bestDistance) {
          bestDistance = d;
          next = candidate;
        }
      }
    }

    current = next;
  }

  return ordered;
};

export const findContours = (
  edgeMask: EdgeMask,
  minPixels = 120
): DetectedContour[] => {
  const { width, height, data } = edgeMask;
  const visited = new Uint8Array(width * height);
  const contours: DetectedContour[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const startIndex = (y * width) + x;
      if (visited[startIndex] || data[startIndex] === 0) continue;

      const queue: BorderGuidePoint[] = [{ x, y }];
      visited[startIndex] = 1;
      const component: BorderGuidePoint[] = [];

      for (let q = 0; q < queue.length; q += 1) {
        const current = queue[q];
        component.push(current);

        for (const [dx, dy] of NEIGHBORS_8) {
          const nx = current.x + dx;
          const ny = current.y + dy;
          if (!inBounds(nx, ny, width, height)) continue;
          const index = (ny * width) + nx;
          if (visited[index] || data[index] === 0) continue;
          visited[index] = 1;
          queue.push({ x: nx, y: ny });
        }
      }

      if (component.length < minPixels) continue;

      const componentSet = new Set(component.map((point) => pointKey(point.x, point.y)));
      const boundary = componentToBoundary(component, componentSet);
      if (boundary.length < 3) continue;

      contours.push({
        id: `contour-${contours.length + 1}`,
        points: boundary,
        pixelCount: component.length,
        perimeter: approximatePerimeter(boundary),
      });
    }
  }

  return contours.sort((a, b) => b.perimeter - a.perimeter);
};

const perpendicularDistance = (point: BorderGuidePoint, start: BorderGuidePoint, end: BorderGuidePoint): number => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / ((dx * dx) + (dy * dy));
  const px = start.x + (t * dx);
  const py = start.y + (t * dy);
  return Math.hypot(point.x - px, point.y - py);
};

export const simplifyPath = (points: BorderGuidePoint[], tolerance = 2): BorderGuidePoint[] => {
  if (points.length <= 3) return [...points];
  const epsilon = Math.max(0.1, tolerance);

  const rdp = (input: BorderGuidePoint[]): BorderGuidePoint[] => {
    if (input.length <= 2) return input;
    let maxDistance = 0;
    let index = 0;
    for (let i = 1; i < input.length - 1; i += 1) {
      const distance = perpendicularDistance(input[i], input[0], input[input.length - 1]);
      if (distance > maxDistance) {
        maxDistance = distance;
        index = i;
      }
    }

    if (maxDistance <= epsilon) {
      return [input[0], input[input.length - 1]];
    }

    const left = rdp(input.slice(0, index + 1));
    const right = rdp(input.slice(index));
    return [...left.slice(0, -1), ...right];
  };

  const closed = points[0].x === points[points.length - 1].x && points[0].y === points[points.length - 1].y;
  const source = closed ? points.slice(0, -1) : points;
  const simplified = rdp(source);
  return simplified;
};

export const drawContourPreview = (
  canvas: HTMLCanvasElement,
  contours: DetectedContour[],
  selectedContourId: string | null,
  selectedSimplified: BorderGuidePoint[] | null,
  showContours = true
): void => {
  const context = canvas.getContext('2d');
  if (!context) return;

  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!showContours) return;

  context.lineJoin = 'round';
  context.lineCap = 'round';

  for (const contour of contours) {
    if (contour.points.length < 2) continue;
    context.beginPath();
    context.moveTo(contour.points[0].x, contour.points[0].y);
    for (let i = 1; i < contour.points.length; i += 1) {
      context.lineTo(contour.points[i].x, contour.points[i].y);
    }
    context.closePath();
    context.strokeStyle = contour.id === selectedContourId ? 'rgba(255,0,0,0.8)' : 'rgba(180,180,180,0.55)';
    context.lineWidth = contour.id === selectedContourId ? 2.2 : 1.2;
    context.stroke();
  }

  if (selectedSimplified && selectedSimplified.length > 1) {
    context.beginPath();
    context.moveTo(selectedSimplified[0].x, selectedSimplified[0].y);
    for (let i = 1; i < selectedSimplified.length; i += 1) {
      context.lineTo(selectedSimplified[i].x, selectedSimplified[i].y);
    }
    context.closePath();
    context.strokeStyle = 'rgba(255,0,0,0.98)';
    context.lineWidth = 3;
    context.stroke();
  }
};

const distancePointToSegment = (point: BorderGuidePoint, a: BorderGuidePoint, b: BorderGuidePoint): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / ((dx * dx) + (dy * dy))));
  const px = a.x + (t * dx);
  const py = a.y + (t * dy);
  return Math.hypot(point.x - px, point.y - py);
};

export const pickContourByPoint = (
  contours: DetectedContour[],
  point: BorderGuidePoint,
  maxDistance = 16
): string | null => {
  let selectedId: string | null = null;
  let bestDistance = maxDistance;

  for (const contour of contours) {
    const points = contour.points;
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      const distance = distancePointToSegment(point, a, b);
      if (distance < bestDistance) {
        bestDistance = distance;
        selectedId = contour.id;
      }
    }
  }

  return selectedId;
};

export const drawEdgeOverlay = (
  canvas: HTMLCanvasElement,
  edges: EdgeMask
): void => {
  const context = canvas.getContext('2d', { willReadFrequently: false });
  if (!context) return;

  if (canvas.width !== edges.width || canvas.height !== edges.height) {
    canvas.width = edges.width;
    canvas.height = edges.height;
  }

  const overlay = context.createImageData(edges.width, edges.height);
  const overlayData = overlay.data;

  for (let index = 0; index < edges.data.length; index += 1) {
    if (edges.data[index] === 0) continue;
    const offset = index * 4;
    overlayData[offset] = 255;
    overlayData[offset + 1] = 0;
    overlayData[offset + 2] = 0;
    overlayData[offset + 3] = 180;
  }

  context.clearRect(0, 0, edges.width, edges.height);
  context.putImageData(overlay, 0, 0);
};

export const clearEdgeOverlay = (canvas: HTMLCanvasElement): void => {
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
};

export const addBorderPoint = (
  points: BorderGuidePoint[],
  x: number,
  y: number
): BorderGuidePoint[] => [...points, { x, y }];

export const startBorderDrawing = (): BorderGuidePoint[] => [];

export const finishBorder = (points: BorderGuidePoint[]): BorderGuidePoint[] => points.map((point) => ({ ...point }));

export const toSnapBorderPoints = (points: BorderGuidePoint[]): Array<{ x: number; y: number; angle: number }> => {
  if (points.length < 2) return [];

  const isClosed = points.length > 2;
  const snapPoints: Array<{ x: number; y: number; angle: number }> = [];
  const lastIndex = points.length - 1;

  for (let index = 0; index < points.length; index += 1) {
    const previousIndex = index === 0 ? (isClosed ? lastIndex : 0) : index - 1;
    const nextIndex = index === lastIndex ? (isClosed ? 0 : lastIndex) : index + 1;
    const previous = points[previousIndex];
    const next = points[nextIndex];
    const angle = Math.atan2(next.y - previous.y, next.x - previous.x) * (180 / Math.PI);

    snapPoints.push({
      x: points[index].x,
      y: points[index].y,
      angle: ((angle % 360) + 360) % 360,
    });
  }

  return snapPoints;
};

export const buildSnapPoints = (
  points: BorderGuidePoint[],
  interpolationStep = 10
): Array<{ x: number; y: number; angle: number }> => {
  if (points.length < 2) return [];

  const step = Math.max(2, interpolationStep);
  const snapPoints: Array<{ x: number; y: number; angle: number }> = [];

  for (let index = 0; index < points.length; index += 1) {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const segmentLength = Math.hypot(dx, dy);
    if (segmentLength < 0.001) continue;

    const angle = ((Math.atan2(dy, dx) * (180 / Math.PI)) % 360 + 360) % 360;
    const steps = Math.max(1, Math.ceil(segmentLength / step));

    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      snapPoints.push({
        x: start.x + (dx * t),
        y: start.y + (dy * t),
        angle,
      });
    }
  }

  return snapPoints;
};

export const drawBorder = (
  canvas: HTMLCanvasElement,
  points: BorderGuidePoint[],
  showPoints = true
): void => {
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (points.length < 2) return;

  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    context.lineTo(points[i].x, points[i].y);
  }
  context.closePath();
  context.strokeStyle = 'rgba(255, 0, 0, 0.95)';
  context.lineWidth = 2.2;
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.stroke();

  if (!showPoints) return;
  context.fillStyle = 'rgba(255, 0, 0, 0.95)';
  for (const point of points) {
    context.beginPath();
    context.arc(point.x, point.y, 3, 0, Math.PI * 2);
    context.fill();
  }
};

export const clearBorderOverlay = (canvas: HTMLCanvasElement): void => {
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
};

export const loadBorderPoints = async (file: File): Promise<BorderGuidePoint[]> => {
  const text = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Failed to read border file.'));
    reader.readAsText(file);
  });

  let parsed: unknown;
  try {
    const normalized = text.replace(/^\uFEFF/, '').trim();
    parsed = JSON.parse(normalized);
  } catch {
    throw new Error('Invalid JSON file. Ensure it is raw JSON (starts with [ and contains only points).');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Border JSON must be an array of points.');
  }

  const points: BorderGuidePoint[] = [];
  for (const entry of parsed) {
    if (
      typeof entry !== 'object'
      || entry === null
      || !('x' in entry)
      || !('y' in entry)
      || typeof (entry as { x: unknown }).x !== 'number'
      || typeof (entry as { y: unknown }).y !== 'number'
    ) {
      throw new Error('Each point must contain numeric x and y.');
    }
    points.push({ x: (entry as { x: number }).x, y: (entry as { y: number }).y });
  }

  if (points.length < 3) {
    throw new Error('Border path needs at least 3 points.');
  }

  return points;
};
