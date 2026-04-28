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

