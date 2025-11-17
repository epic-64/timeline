import { Break } from '../events/types';

/**
 * Converts a timestamp to a non-linear position (0-1) with zoom factor applied.
 * Recent dates get more space, older dates get compressed.
 */
export function timeToZoomedPosition(
  timestamp: number,
  timelineStart: Date,
  timelineEnd: Date,
  zoomFactor: number
): number {
  const timelineSpan = timelineEnd.getTime() - timelineStart.getTime();
  const offset = timestamp - timelineStart.getTime();
  const linearPosition = offset / timelineSpan; // 0 to 1

  if (zoomFactor === 0) {
    return linearPosition; // No zoom, linear
  }

  // Use logarithmic scale for smoother compression
  // Invert the position so recent dates expand and old dates compress
  const scale = zoomFactor * 10; // Amplify the effect
  const inverted = 1 - linearPosition; // Invert: 0 becomes 1, 1 becomes 0
  const shifted = inverted * scale + 1; // Shift to avoid log(0)
  const logMax = Math.log(scale + 1);
  const logResult = Math.log(shifted) / logMax;

  return 1 - logResult; // Invert back
}

/**
 * Converts a zoomed position (0-1) back to a timestamp.
 * Used for reverse mapping during dragging operations.
 */
export function zoomedPositionToTime(
  zoomedPosition: number,
  timelineStart: Date,
  timelineEnd: Date,
  zoomFactor: number
): number {
  const timelineSpan = timelineEnd.getTime() - timelineStart.getTime();

  if (zoomFactor === 0) {
    return timelineStart.getTime() + zoomedPosition * timelineSpan;
  }

  // Reverse the logarithmic zoom
  const scale = zoomFactor * 10;
  const logMax = Math.log(scale + 1);
  const inverted = 1 - zoomedPosition; // Invert
  const shifted = Math.exp(inverted * logMax);
  const invertedLinear = (shifted - 1) / scale;
  const linearPosition = 1 - invertedLinear; // Invert back

  return timelineStart.getTime() + linearPosition * timelineSpan;
}

/**
 * Formats a date range as a string.
 */
export function formatDateRange(start: Date, end: Date | null): string {
  const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (end === null) {
    return `${startStr} - Present`;
  }
  const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startStr} - ${endStr}`;
}

/**
 * Calculates the duration between two dates, accounting for breaks.
 */
export function calculateDuration(start: Date, end: Date | null, breaks: Break[] = []): string {
  const effectiveEnd = end || new Date();

  // Calculate total duration in milliseconds
  let totalMs = effectiveEnd.getTime() - start.getTime();

  // Subtract break durations
  for (const breakPeriod of breaks) {
    const breakStart = new Date(breakPeriod.startDate);
    const breakEnd = new Date(breakPeriod.endDate);
    
    // Only count breaks that are within the event period
    if (breakStart < effectiveEnd && breakEnd > start) {
      const effectiveBreakStart = breakStart < start ? start : breakStart;
      const effectiveBreakEnd = breakEnd > effectiveEnd ? effectiveEnd : breakEnd;
      const breakDuration = effectiveBreakEnd.getTime() - effectiveBreakStart.getTime();
      totalMs -= breakDuration;
    }
  }

  // Convert milliseconds to months
  const msPerDay = 24 * 60 * 60 * 1000;
  const msPerMonth = msPerDay * 30.44; // Average days per month
  const totalMonths = Math.floor(totalMs / msPerMonth);

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  // Format the output
  const parts: string[] = [];
  if (years > 0) {
    parts.push(`${years} ${years === 1 ? 'year' : 'years'}`);
  }
  if (months > 0) {
    parts.push(`${months} ${months === 1 ? 'month' : 'months'}`);
  }

  if (parts.length === 0) {
    return 'Less than 1 month';
  }

  return parts.join(', ');
}

/**
 * Snaps a date to the start of its month.
 */
export function snapToStartOfMonth(date: Date): Date {
  const snapped = new Date(date);
  snapped.setDate(1);
  snapped.setHours(0, 0, 0, 0);
  return snapped;
}

/**
 * Snaps a date to the end of its month.
 */
export function snapToEndOfMonth(date: Date): Date {
  const snapped = new Date(date);
  // Go to next month, then back one day
  snapped.setMonth(snapped.getMonth() + 1);
  snapped.setDate(0);
  snapped.setHours(23, 59, 59, 999);
  return snapped;
}

