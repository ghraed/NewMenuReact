export type BorderGuidePoint = {
  x: number;
  y: number;
};

export type EdgeMask = {
  width: number;
  height: number;
  data: Uint8Array;
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
