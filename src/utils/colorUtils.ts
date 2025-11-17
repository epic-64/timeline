/**
 * Converts a hex color string to RGB components.
 */
export function hexToRgb(
  hex: string,
): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Converts an RGB color string to hex format.
 */
export function rgbToHex(rgb: string): string {
  const result = rgb.match(/\d+/g);
  if (!result || result.length < 3) return '';
  const r = parseInt(result[0]);
  const g = parseInt(result[1]);
  const b = parseInt(result[2]);
  return (
    '#' +
    [r, g, b]
      .map((x) => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('')
      .toUpperCase()
  );
}

/**
 * Applies a color to an event element by setting CSS variables.
 */
export function applyEventColor(eventEl: HTMLElement, color: string): void {
  const rgb = hexToRgb(color);
  if (!rgb) return;

  eventEl.style.setProperty('--event-color-r', rgb.r.toString());
  eventEl.style.setProperty('--event-color-g', rgb.g.toString());
  eventEl.style.setProperty('--event-color-b', rgb.b.toString());
}

/**
 * Default color palette for timeline events.
 */
export const COLOR_PALETTE = [
  '#017EFE', // Blue (default)
  '#1b81f0', // Red
  '#41b3ff', // Green
  '#1ff2ff', // Orange
  '#1dfa6c', // Purple
  '#5dd334', // Turquoise
  '#f9fd2c', // Yellow
  '#ffc223', // Pink
  '#ff7f2d', // Cyan
  '#ff1010', // Deep Purple
  '#ff32c8', // Coral
  '#d923ff', // Sky Blue
  '#8624ff', // Light Pink
  '#5224ff', // Light Blue
  '#1b04d5', // Aqua
  '#018e2c', // Amber
  '#a3af02', // Teal
  '#ab2103', // Rose
  '#a90152', // Magenta
  '#979797', // Lavender
];
