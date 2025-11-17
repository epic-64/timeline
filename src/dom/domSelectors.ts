/**
 * Utilities for DOM selection and manipulation specific to timeline elements.
 */

/**
 * Finds a timeline event wrapper element by ID.
 */
export function findEventWrapper(
  container: HTMLElement,
  id: number,
): HTMLElement | null {
  return container.querySelector(`[data-id="${id}"]`) as HTMLElement;
}

/**
 * Finds the timeline event element within a wrapper.
 */
export function findEventElement(wrapper: HTMLElement): HTMLElement | null {
  return wrapper.querySelector('.timeline-event') as HTMLElement;
}

/**
 * Gets all timeline event wrapper elements from a container.
 */
export function getAllEventWrappers(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll('.timeline-event-wrapper'),
  ) as HTMLElement[];
}

/**
 * Extracts event IDs from wrapper elements in order.
 */
export function extractEventIdsFromWrappers(wrappers: HTMLElement[]): number[] {
  return wrappers.map((w) => parseInt(w.dataset.id || '0', 10));
}

/**
 * Adds a CSS class to an element.
 */
export function addClassToElement(
  element: HTMLElement | null,
  className: string,
): void {
  element?.classList.add(className);
}

/**
 * Removes a CSS class from an element.
 */
export function removeClassFromElement(
  element: HTMLElement | null,
  className: string,
): void {
  element?.classList.remove(className);
}

/**
 * Toggles a CSS class on an element.
 */
export function toggleClassOnElement(
  element: HTMLElement | null,
  className: string,
): void {
  element?.classList.toggle(className);
}

/**
 * Closes all open color pickers except the specified one.
 */
export function closeAllColorPickersExcept(
  exceptPicker: HTMLElement | null,
): void {
  document.querySelectorAll('.color-picker.show').forEach((picker) => {
    if (picker !== exceptPicker) {
      picker.classList.remove('show');
    }
  });
}

/**
 * Closes all open color pickers.
 */
export function closeAllColorPickers(): void {
  document.querySelectorAll('.color-picker.show').forEach((picker) => {
    picker.classList.remove('show');
  });
}

/**
 * Finds the color picker element within a wrapper.
 */
export function findColorPicker(wrapper: HTMLElement): HTMLElement | null {
  return wrapper?.querySelector('.color-picker') as HTMLElement;
}

/**
 * Finds date display elements within a timeline event.
 */
export function findDateDisplayElements(
  wrapper: HTMLElement,
  eventEl: HTMLElement,
): {
  datesEl: HTMLElement | null;
  externalDatesEl: HTMLElement | null;
} {
  const datesEl = eventEl.querySelector('.timeline-event-dates') as HTMLElement;
  const externalDatesEl = wrapper.querySelector(
    '.timeline-event-dates-external',
  ) as HTMLElement;

  return { datesEl, externalDatesEl };
}

/**
 * Updates the HTML content of date display elements.
 */
export function updateDateDisplays(
  datesEl: HTMLElement | null,
  externalDatesEl: HTMLElement | null,
  htmlContent: string,
): void {
  if (datesEl) {
    datesEl.innerHTML = htmlContent;
  }
  if (externalDatesEl) {
    externalDatesEl.innerHTML = htmlContent;
  }
}
