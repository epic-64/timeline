/**
 * Timeline configuration and settings management utilities.
 */

const TIMELINE_START_YEAR_KEY = 'timelineStartYear';
const TIMELINE_END_DATE_KEY = 'timelineEndDate';
const DEFAULT_START_YEAR = 2010;

/**
 * Loads timeline start date from localStorage or returns default.
 */
export function loadTimelineStartDate(): Date {
  const savedStartYear = localStorage.getItem(TIMELINE_START_YEAR_KEY);
  const year = savedStartYear ? parseInt(savedStartYear) : DEFAULT_START_YEAR;
  return new Date(year, 0, 1);
}

/**
 * Loads timeline end date from localStorage or returns default (today).
 */
export function loadTimelineEndDate(): Date {
  const savedEndDate = localStorage.getItem(TIMELINE_END_DATE_KEY);
  return savedEndDate ? new Date(savedEndDate) : new Date();
}

/**
 * Saves timeline start year to localStorage.
 */
export function saveTimelineStartYear(year: number): void {
  localStorage.setItem(TIMELINE_START_YEAR_KEY, year.toString());
}

/**
 * Saves timeline end date to localStorage.
 */
export function saveTimelineEndDate(date: Date): void {
  localStorage.setItem(TIMELINE_END_DATE_KEY, date.toISOString());
}

/**
 * Validates a year input.
 */
export function isValidYear(year: number): boolean {
  return year >= 1900 && year <= 2100;
}

/**
 * Formats a date for an HTML date input (YYYY-MM-DD).
 */
export function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Creates date header markers for years in the timeline range.
 */
export function createYearMarkers(
  startYear: number,
  endYear: number,
  getZoomedPosition: (yearDate: Date) => number,
): HTMLElement[] {
  const markers: HTMLElement[] = [];

  for (let year = startYear; year <= endYear; year++) {
    const yearDate = new Date(year, 0, 1); // January 1st of each year
    const zoomedPos = getZoomedPosition(yearDate);

    const dateEl = document.createElement('div');
    dateEl.className = 'timeline-date';
    dateEl.textContent = year.toString();
    dateEl.style.left = `${zoomedPos * 100}%`;
    dateEl.style.position = 'absolute';

    markers.push(dateEl);
  }

  return markers;
}

