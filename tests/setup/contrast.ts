import type { Locator } from '@playwright/test';

// Alpha-compose computed solid backgrounds, then use WCAG relative luminance.
// These checks target solid login/POS surfaces, not image/gradient content.
export const textContrast = (locator: Locator): Promise<number> => locator.evaluate((element) => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const paint = canvas.getContext('2d')!;
  const rgba = (color: string): number[] => {
    // Canvas resolves both legacy rgba() and Tailwind 4's color(srgb ...) syntax.
    paint.clearRect(0, 0, 1, 1);
    paint.fillStyle = color;
    paint.fillRect(0, 0, 1, 1);
    const bytes = paint.getImageData(0, 0, 1, 1).data;
    return [bytes[0], bytes[1], bytes[2], bytes[3] / 255];
  };
  const blend = (fg: number[], bg: number[]): number[] => fg.slice(0, 3).map((value, index) => value * fg[3] + bg[index] * (1 - fg[3]));
  const ancestors: Element[] = [];
  for (let node: Element | null = element; node; node = node.parentElement) ancestors.unshift(node);
  let background = [255, 255, 255];
  for (const ancestor of ancestors) background = blend(rgba(getComputedStyle(ancestor).backgroundColor), background);
  const foreground = blend(rgba(getComputedStyle(element).color), background);
  const luminance = (color: number[]) => color.map((value) => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
});
