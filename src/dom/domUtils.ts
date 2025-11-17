import { TimelineEvent } from '../events';
import { applyEventColor, calculateDuration, COLOR_PALETTE, formatDateRange } from '../utils';

/**
 * Creates a timeline event wrapper with all its UI components.
 */
export function createEventElement(
  event: TimelineEvent,
  handlers: {
    onNameEdit: (newName: string) => void;
    onResizeLeft: (e: MouseEvent) => void;
    onResizeRight: (e: MouseEvent) => void;
    onToggleEndDate: (e: MouseEvent) => void;
    onToggleColorPicker: (e: MouseEvent) => void;
    onChangeColor: (color: string) => void;
    onDelete: (e: MouseEvent) => void;
    onOpenBreaks: (e: MouseEvent) => void;
    onSelect: (e: MouseEvent) => void;
    onStartVerticalReorder: (e: MouseEvent) => void;
  },
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'timeline-event-wrapper';
  wrapper.dataset.id = event.id.toString();

  // External date label (for short events)
  const externalDatesEl = document.createElement('span');
  externalDatesEl.className = 'timeline-event-dates-external';
  const dateRangeText = formatDateRange(event.startDate, event.endDate);
  const durationText = calculateDuration(event.startDate, event.endDate);
  externalDatesEl.innerHTML = `${dateRangeText}<br><span class="duration">${durationText}</span>`;

  const eventEl = document.createElement('div');
  eventEl.className = 'timeline-event';
  eventEl.dataset.color = event.color;

  // Apply color to event
  applyEventColor(eventEl, event.color);

  // Mark as open-ended if no end date
  if (event.endDate === null) {
    eventEl.classList.add('open-ended');
  }

  const content = document.createElement('div');
  content.className = 'timeline-event-content';

  const nameEl = createEditableNameElement(event.name, handlers.onNameEdit);
  const datesEl = createDatesElement(dateRangeText, durationText);

  content.appendChild(nameEl);
  content.appendChild(datesEl);

  // Resize handles
  const leftHandle = createResizeHandle('left', handlers.onResizeLeft);
  const rightHandle = createResizeHandle('right', handlers.onResizeRight);

  eventEl.appendChild(leftHandle);
  eventEl.appendChild(content);
  eventEl.appendChild(rightHandle);

  // Buttons
  const clearEndBtn = createClearEndButton(
    event.endDate,
    handlers.onToggleEndDate,
  );
  const colorBtn = createColorButton(handlers.onToggleColorPicker);
  const breaksBtn = createBreaksButton(handlers.onOpenBreaks);
  const deleteBtn = createDeleteButton(handlers.onDelete);

  // Color picker dropdown
  const colorPicker = createColorPicker(event.color, handlers.onChangeColor);

  wrapper.appendChild(externalDatesEl);
  wrapper.appendChild(eventEl);
  wrapper.appendChild(colorPicker);
  wrapper.appendChild(colorBtn);
  wrapper.appendChild(clearEndBtn);
  wrapper.appendChild(breaksBtn);
  wrapper.appendChild(deleteBtn);

  // Click to select
  eventEl.addEventListener('click', handlers.onSelect);

  // Drag to reorder vertically
  content.addEventListener('mousedown', handlers.onStartVerticalReorder);

  return wrapper;
}

/**
 * Creates an editable name element for timeline events.
 */
function createEditableNameElement(
  name: string,
  onEdit: (newName: string) => void,
): HTMLElement {
  const nameEl = document.createElement('span');
  nameEl.className = 'timeline-event-name';
  nameEl.textContent = name;
  nameEl.contentEditable = 'false';

  // Make editable only when clicked
  nameEl.addEventListener('click', (e) => {
    e.stopPropagation();
    if (nameEl.contentEditable === 'false') {
      nameEl.contentEditable = 'true';
      nameEl.focus();
      // Move cursor to the end
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(nameEl);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  });

  nameEl.addEventListener('blur', (e) => {
    nameEl.contentEditable = 'false';
    const newName = (e.target as HTMLElement).textContent || name;
    onEdit(newName);
  });

  nameEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      (e.target as HTMLElement).blur();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      nameEl.textContent = name; // Restore original text
      (e.target as HTMLElement).blur();
    }
  });

  return nameEl;
}

/**
 * Creates a dates display element.
 */
function createDatesElement(
  dateRangeText: string,
  durationText: string,
): HTMLElement {
  const datesEl = document.createElement('span');
  datesEl.className = 'timeline-event-dates';
  datesEl.innerHTML = `${dateRangeText}<br><span class="duration">${durationText}</span>`;
  return datesEl;
}

/**
 * Creates a resize handle element.
 */
function createResizeHandle(
  side: 'left' | 'right',
  onMouseDown: (e: MouseEvent) => void,
): HTMLElement {
  const handle = document.createElement('div');
  handle.className = `timeline-event-handle ${side}`;
  handle.addEventListener('mousedown', onMouseDown);
  return handle;
}

/**
 * Creates a clear end date button.
 */
function createClearEndButton(
  endDate: Date | null,
  onClick: (e: MouseEvent) => void,
): HTMLElement {
  const btn = document.createElement('button');
  btn.className = 'clear-end-button';
  btn.textContent = endDate === null ? '📅' : '∞';
  btn.title = endDate === null ? 'Set End Date' : 'Clear End Date (Ongoing)';
  btn.addEventListener('click', onClick);
  return btn;
}

/**
 * Creates a color picker button.
 */
function createColorButton(onClick: (e: MouseEvent) => void): HTMLElement {
  const btn = document.createElement('button');
  btn.className = 'color-button';
  btn.textContent = '🎨';
  btn.title = 'Change Color';
  btn.addEventListener('click', onClick);
  return btn;
}

/**
 * Creates a breaks management button.
 */
function createBreaksButton(onClick: (e: MouseEvent) => void): HTMLElement {
  const btn = document.createElement('button');
  btn.className = 'breaks-button';
  btn.textContent = '⏸';
  btn.title = 'Manage Breaks';
  btn.addEventListener('click', onClick);
  return btn;
}

/**
 * Creates a delete button.
 */
function createDeleteButton(onClick: (e: MouseEvent) => void): HTMLElement {
  const btn = document.createElement('button');
  btn.className = 'delete-button';
  btn.textContent = '×';
  btn.addEventListener('click', onClick);
  return btn;
}

/**
 * Creates a color picker dropdown.
 */
function createColorPicker(
  currentColor: string,
  onColorChange: (color: string) => void,
): HTMLElement {
  const colorPicker = document.createElement('div');
  colorPicker.className = 'color-picker';

  COLOR_PALETTE.forEach((color) => {
    const colorOption = document.createElement('div');
    colorOption.className = 'color-option';
    colorOption.style.backgroundColor = color;
    if (color === currentColor) {
      colorOption.classList.add('selected');
    }
    colorOption.addEventListener('click', (e) => {
      e.stopPropagation();
      onColorChange(color);
    });
    colorPicker.appendChild(colorOption);
  });

  return colorPicker;
}

/**
 * Renders break overlays on an event element.
 */
export function renderBreaks(eventEl: HTMLElement, event: TimelineEvent): void {
  // Remove existing break overlays
  eventEl
    .querySelectorAll('.timeline-event-break')
    .forEach((el) => el.remove());

  if (!event.breaks || event.breaks.length === 0) return;

  const effectiveEndDate = event.endDate || new Date();
  const eventStart = event.startDate.getTime();
  const eventEnd = effectiveEndDate.getTime();
  const eventDuration = eventEnd - eventStart;

  if (eventDuration <= 0) return;

  // Render each break as an overlay
  event.breaks.forEach((breakPeriod) => {
    const breakStart = new Date(breakPeriod.startDate).getTime();
    const breakEnd = new Date(breakPeriod.endDate).getTime();

    // Only render breaks that are within the event period
    if (breakStart < eventEnd && breakEnd > eventStart) {
      const effectiveBreakStart = Math.max(breakStart, eventStart);
      const effectiveBreakEnd = Math.min(breakEnd, eventEnd);

      // Calculate position and width as percentage of event bar
      const leftPercent =
        ((effectiveBreakStart - eventStart) / eventDuration) * 100;
      const widthPercent =
        ((effectiveBreakEnd - effectiveBreakStart) / eventDuration) * 100;

      const breakEl = document.createElement('div');
      breakEl.className = 'timeline-event-break';
      breakEl.style.left = `${leftPercent}%`;
      breakEl.style.width = `${widthPercent}%`;
      breakEl.title = `Break: ${new Date(breakPeriod.startDate).toLocaleDateString()} - ${new Date(breakPeriod.endDate).toLocaleDateString()}`;

      eventEl.appendChild(breakEl);
    }
  });
}
