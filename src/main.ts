//TIP With Search Everywhere, you can find any action, file, or symbol in your project. Press <shortcut actionId="Shift"/> <shortcut actionId="Shift"/>, type in <b>terminal</b>, and press <shortcut actionId="EditorEnter"/>. Then run <shortcut raw="npm run dev"/> in the terminal and click the link in its output to open the app in the browser.
import html2canvas from 'html2canvas';

interface TimelineEvent {
  id: number;
  name: string;
  startDate: Date;
  endDate: Date | null;
  color: string;
}

class Timeline {
  private events: TimelineEvent[] = [];
  private nextId = 1;
  private eventsContainer: HTMLElement;
  private datesContainer: HTMLElement;
  private draggedEvent: { id: number; type: 'move' | 'resize-left' | 'resize-right' } | null = null;
  private dragStartX = 0;
  private selectedEventId: number | null = null;

  // Timeline spans 12 months from today
  private timelineStart: Date;
  private timelineEnd: Date;

  // Zoom factor: higher values give more weight to recent years
  // 0 = linear (no zoom), 1 = moderate zoom, 2 = strong zoom
  private zoomFactor = 1.5;

  // Color palette
  private readonly colorPalette = [
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

  constructor() {
    this.eventsContainer = document.getElementById('timeline-events') as HTMLElement;
    this.datesContainer = document.getElementById('timeline-dates') as HTMLElement;

    // Load saved settings or use defaults
    const savedStartYear = localStorage.getItem('timelineStartYear');
    const savedEndDate = localStorage.getItem('timelineEndDate');

    this.timelineStart = new Date(savedStartYear ? parseInt(savedStartYear) : 2010, 0, 1);
    this.timelineEnd = savedEndDate ? new Date(savedEndDate) : new Date();

    this.setupEventListeners();
    this.initializeInputFields();
    this.renderDateHeader();
    this.loadEvents();
  }

  private setupEventListeners() {
    document.getElementById('addEvent')?.addEventListener('click', () => this.addEvent());
    document.getElementById('exportEvents')?.addEventListener('click', () => this.exportEvents());
    document.getElementById('importEvents')?.addEventListener('click', () => this.importEvents());
    document.getElementById('downloadImage')?.addEventListener('click', () => this.downloadAsImage());

    document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    document.addEventListener('mouseup', () => this.handleMouseUp());
    document.addEventListener('click', (e) => this.handleDocumentClick(e));
  }

  private initializeInputFields() {
    const startYearInput = document.getElementById('startYear') as HTMLInputElement;
    const endDateInput = document.getElementById('endDate') as HTMLInputElement;

    if (startYearInput) {
      startYearInput.value = this.timelineStart.getFullYear().toString();
      startYearInput.addEventListener('change', (e) => {
        const year = parseInt((e.target as HTMLInputElement).value);
        if (year && year >= 1900 && year <= 2100) {
          this.timelineStart = new Date(year, 0, 1);
          localStorage.setItem('timelineStartYear', year.toString());
          this.refreshTimeline();
        }
      });
    }

    if (endDateInput) {
      // Format date as YYYY-MM-DD for input
      const year = this.timelineEnd.getFullYear();
      const month = String(this.timelineEnd.getMonth() + 1).padStart(2, '0');
      const day = String(this.timelineEnd.getDate()).padStart(2, '0');
      endDateInput.value = `${year}-${month}-${day}`;

      endDateInput.addEventListener('change', (e) => {
        const dateStr = (e.target as HTMLInputElement).value;
        if (dateStr) {
          this.timelineEnd = new Date(dateStr);
          localStorage.setItem('timelineEndDate', this.timelineEnd.toISOString());
          this.refreshTimeline();
        }
      });
    }
  }

  private refreshTimeline() {
    // Re-render date header
    this.renderDateHeader();

    // Re-render all events with new positions
    const wrappers = Array.from(this.eventsContainer.querySelectorAll('.timeline-event-wrapper')) as HTMLElement[];
    wrappers.forEach(wrapper => {
      const id = parseInt(wrapper.dataset.id || '0', 10);
      const event = this.events.find(e => e.id === id);
      const eventEl = wrapper.querySelector('.timeline-event') as HTMLElement;
      if (event && eventEl) {
        this.updateEventPosition(wrapper, eventEl, event);
      }
    });
  }

  /**
   * Converts a timestamp to a non-linear position (0-1) with zoom factor applied.
   * Recent dates get more space, older dates get compressed.
   */
  private timeToZoomedPosition(timestamp: number): number {
    const timelineSpan = this.timelineEnd.getTime() - this.timelineStart.getTime();
    const offset = timestamp - this.timelineStart.getTime();
    const linearPosition = offset / timelineSpan; // 0 to 1

    if (this.zoomFactor === 0) {
      return linearPosition; // No zoom, linear
    }

    // Use logarithmic scale for smoother compression
    // Invert the position so recent dates expand and old dates compress
    const scale = this.zoomFactor * 10; // Amplify the effect
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
  private zoomedPositionToTime(zoomedPosition: number): number {
    const timelineSpan = this.timelineEnd.getTime() - this.timelineStart.getTime();

    if (this.zoomFactor === 0) {
      return this.timelineStart.getTime() + zoomedPosition * timelineSpan;
    }

    // Reverse the logarithmic zoom
    const scale = this.zoomFactor * 10;
    const logMax = Math.log(scale + 1);
    const inverted = 1 - zoomedPosition; // Invert
    const shifted = Math.exp(inverted * logMax);
    const invertedLinear = (shifted - 1) / scale;
    const linearPosition = 1 - invertedLinear; // Invert back

    return this.timelineStart.getTime() + linearPosition * timelineSpan;
  }

  private renderDateHeader() {
    this.datesContainer.innerHTML = '';
    const startYear = this.timelineStart.getFullYear();
    const endYear = this.timelineEnd.getFullYear();

    // Create markers for each year with zoomed positioning
    for (let year = startYear; year <= endYear; year++) {
      const yearDate = new Date(year, 0, 1); // January 1st of each year
      const zoomedPos = this.timeToZoomedPosition(yearDate.getTime());

      const dateEl = document.createElement('div');
      dateEl.className = 'timeline-date';
      dateEl.textContent = year.toString();
      dateEl.style.left = `${zoomedPos * 100}%`;
      dateEl.style.position = 'absolute';
      this.datesContainer.appendChild(dateEl);
    }
  }

  addEvent() {
    // Calculate the middle of the timeline range
    const timelineSpan = this.timelineEnd.getTime() - this.timelineStart.getTime();
    const middleTimestamp = this.timelineStart.getTime() + (timelineSpan / 2);

    const start = new Date(middleTimestamp);
    const end = new Date(middleTimestamp);

    // Add 3 years to the end date
    end.setFullYear(end.getFullYear() + 3);

    const event: TimelineEvent = {
      id: this.nextId++,
      name: `Event ${this.nextId - 1}`,
      startDate: start,
      endDate: end,
      color: this.colorPalette[0] // Default blue
    };

    this.events.push(event);
    this.renderEvent(event);
    this.saveEvents();
  }

  private renderEvent(event: TimelineEvent) {
    const wrapper = document.createElement('div');
    wrapper.className = 'timeline-event-wrapper';
    wrapper.dataset.id = event.id.toString();

    // External date label (for short events)
    const externalDatesEl = document.createElement('span');
    externalDatesEl.className = 'timeline-event-dates-external';
    const dateRangeText = this.formatDateRange(event.startDate, event.endDate);
    const durationText = this.calculateDuration(event.startDate, event.endDate);
    externalDatesEl.innerHTML = `${dateRangeText}<br><span class="duration">${durationText}</span>`;

    const eventEl = document.createElement('div');
    eventEl.className = 'timeline-event';
    eventEl.dataset.color = event.color;

    // Apply color to event
    this.applyEventColor(eventEl, event.color);

    // Mark as open-ended if no end date
    if (event.endDate === null) {
      eventEl.classList.add('open-ended');
    }

    const content = document.createElement('div');
    content.className = 'timeline-event-content';

    const nameEl = document.createElement('span');
    nameEl.className = 'timeline-event-name';
    nameEl.textContent = event.name;
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
        range.collapse(false); // false = collapse to end
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    });

    nameEl.addEventListener('blur', (e) => {
      nameEl.contentEditable = 'false';
      event.name = (e.target as HTMLElement).textContent || event.name;
      this.saveEvents();
    });

    nameEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        (e.target as HTMLElement).blur();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        nameEl.textContent = event.name; // Restore original text
        (e.target as HTMLElement).blur();
      }
    });

    const datesEl = document.createElement('span');
    datesEl.className = 'timeline-event-dates';
    datesEl.innerHTML = `${dateRangeText}<br><span class="duration">${durationText}</span>`;

    content.appendChild(nameEl);
    content.appendChild(datesEl);

    // Resize handles
    const leftHandle = document.createElement('div');
    leftHandle.className = 'timeline-event-handle left';
    leftHandle.addEventListener('mousedown', (e) => this.startResize(e, event.id, 'resize-left'));

    const rightHandle = document.createElement('div');
    rightHandle.className = 'timeline-event-handle right';
    rightHandle.addEventListener('mousedown', (e) => this.startResize(e, event.id, 'resize-right'));

    eventEl.appendChild(leftHandle);
    eventEl.appendChild(content);
    eventEl.appendChild(rightHandle);

    // Clear end date button
    const clearEndBtn = document.createElement('button');
    clearEndBtn.className = 'clear-end-button';
    clearEndBtn.textContent = event.endDate === null ? '📅' : '∞';
    clearEndBtn.title = event.endDate === null ? 'Set End Date' : 'Clear End Date (Ongoing)';
    clearEndBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleEndDate(event.id);
    });

    // Color picker button
    const colorBtn = document.createElement('button');
    colorBtn.className = 'color-button';
    colorBtn.textContent = '🎨';
    colorBtn.title = 'Change Color';
    colorBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleColorPicker(event.id);
    });

    // Color picker dropdown
    const colorPicker = document.createElement('div');
    colorPicker.className = 'color-picker';
    this.colorPalette.forEach(color => {
      const colorOption = document.createElement('div');
      colorOption.className = 'color-option';
      colorOption.style.backgroundColor = color;
      if (color === event.color) {
        colorOption.classList.add('selected');
      }
      colorOption.addEventListener('click', (e) => {
        e.stopPropagation();
        this.changeEventColor(event.id, color);
      });
      colorPicker.appendChild(colorOption);
    });

    // Delete button (outside the event)
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-button';
    deleteBtn.textContent = '×';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteEvent(event.id);
    });

    wrapper.appendChild(externalDatesEl);
    wrapper.appendChild(eventEl);
    wrapper.appendChild(colorPicker);
    wrapper.appendChild(colorBtn);
    wrapper.appendChild(clearEndBtn);
    wrapper.appendChild(deleteBtn);

    // Click to select - only when clicking on the event element itself
    eventEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectEvent(event.id);
    });


    // Drag to reorder vertically only
    content.addEventListener('mousedown', (e) => this.startVerticalReorder(e, event.id));

    this.eventsContainer.appendChild(wrapper);

    // Now update position after wrapper is in DOM
    this.updateEventPosition(wrapper, eventEl, event);
  }

  private updateEventPosition(wrapper: HTMLElement, eventEl: HTMLElement, event: TimelineEvent) {
    // If no end date, use today's date for visualization
    const effectiveEndDate = event.endDate || new Date();

    // Calculate zoomed positions
    const startZoomedPos = this.timeToZoomedPosition(event.startDate.getTime());
    const endZoomedPos = this.timeToZoomedPosition(effectiveEndDate.getTime());

    const leftPercent = startZoomedPos * 100;
    const widthPercent = (endZoomedPos - startZoomedPos) * 100;

    eventEl.style.width = `${Math.max(widthPercent, 5)}%`;
    eventEl.style.marginLeft = `${Math.max(leftPercent, 0)}%`;

    // Set CSS variable for external date positioning
    wrapper.style.setProperty('--event-left', `${Math.max(leftPercent, 0)}%`);

    // Determine if event is short (less than 2 years)
    const eventDuration = effectiveEndDate.getTime() - event.startDate.getTime();
    const twoYearsInMs = 2 * 365.25 * 24 * 60 * 60 * 1000;
    const isShortEvent = eventDuration < twoYearsInMs;

    // Update or add open-ended class
    if (event.endDate === null) {
      eventEl.classList.add('open-ended');
    } else {
      eventEl.classList.remove('open-ended');
    }

    // Toggle short-event class and date display
    if (isShortEvent) {
      wrapper.classList.add('short-event');
    } else {
      wrapper.classList.remove('short-event');
    }

    // Update both date displays
    const datesEl = eventEl.querySelector('.timeline-event-dates');
    const externalDatesEl = wrapper.querySelector('.timeline-event-dates-external');
    const dateText = this.formatDateRange(event.startDate, event.endDate);
    const durationText = this.calculateDuration(event.startDate, event.endDate);
    const fullText = `${dateText}<br><span class="duration">${durationText}</span>`;

    if (datesEl) {
      datesEl.innerHTML = fullText;
    }
    if (externalDatesEl) {
      externalDatesEl.innerHTML = fullText;
    }
  }

  private formatDateRange(start: Date, end: Date | null): string {
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (end === null) {
      return `${startStr} - Present`;
    }
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startStr} - ${endStr}`;
  }

  private calculateDuration(start: Date, end: Date | null): string {
    const effectiveEnd = end || new Date();

    // Calculate difference in months
    let years = effectiveEnd.getFullYear() - start.getFullYear();
    let months = effectiveEnd.getMonth() - start.getMonth();

    // Adjust for negative months
    if (months < 0) {
      years--;
      months += 12;
    }

    // Adjust for day of month
    if (effectiveEnd.getDate() < start.getDate()) {
      months--;
      if (months < 0) {
        years--;
        months += 12;
      }
    }

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

  private snapToStartOfMonth(date: Date): Date {
    const snapped = new Date(date);
    snapped.setDate(1);
    snapped.setHours(0, 0, 0, 0);
    return snapped;
  }

  private snapToEndOfMonth(date: Date): Date {
    const snapped = new Date(date);
    // Go to next month, then back one day
    snapped.setMonth(snapped.getMonth() + 1);
    snapped.setDate(0);
    snapped.setHours(23, 59, 59, 999);
    return snapped;
  }

  private startVerticalReorder(e: MouseEvent, id: number) {
    const target = e.target as HTMLElement;

    // Don't start move if clicking on editable name or button
    if (target.contentEditable === 'true' || target.tagName === 'BUTTON') {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    this.draggedEvent = { id, type: 'move' };
    this.dragStartX = e.clientX;

    const wrapper = this.eventsContainer.querySelector(`[data-id="${id}"]`) as HTMLElement;
    const eventEl = wrapper?.querySelector('.timeline-event') as HTMLElement;
    eventEl?.classList.add('reordering');
  }

  private startResize(e: MouseEvent, id: number, type: 'resize-left' | 'resize-right') {
    e.preventDefault();
    e.stopPropagation();

    this.draggedEvent = { id, type };
    this.dragStartX = e.clientX;
  }

  private handleMouseMove(e: MouseEvent) {
    if (!this.draggedEvent) return;

    // Handle vertical reordering for move type
    if (this.draggedEvent.type === 'move') {
      this.handleReorderMove(e);
      return;
    }

    // Handle horizontal timeline dragging (resize only)
    const event = this.events.find(ev => ev.id === this.draggedEvent!.id);
    if (!event) return;

    const deltaX = e.clientX - this.dragStartX;
    const containerWidth = this.eventsContainer.offsetWidth;

    // Calculate current zoomed position and new zoomed position
    const currentZoomedPos = this.timeToZoomedPosition(
      this.draggedEvent.type === 'resize-left' ? event.startDate.getTime() :
      event.endDate ? event.endDate.getTime() : event.startDate.getTime()
    );

    const deltaZoomedPos = deltaX / containerWidth;
    const newZoomedPos = currentZoomedPos + deltaZoomedPos;

    // Convert back to timestamp
    const newTimestamp = this.zoomedPositionToTime(newZoomedPos);

    if (this.draggedEvent.type === 'resize-left') {
      const newStart = new Date(newTimestamp);
      const compareDate = event.endDate || new Date();
      if (newStart < compareDate) {
        event.startDate = newStart;
      }
    } else if (this.draggedEvent.type === 'resize-right') {
      // Can't resize right handle if no end date
      if (event.endDate !== null) {
        const newEnd = new Date(newTimestamp);
        if (newEnd > event.startDate) {
          event.endDate = newEnd;
        }
      }
    }

    this.dragStartX = e.clientX;

    const wrapper = this.eventsContainer.querySelector(`[data-id="${this.draggedEvent.id}"]`) as HTMLElement;
    const eventEl = wrapper?.querySelector('.timeline-event') as HTMLElement;
    if (wrapper && eventEl) {
      this.updateEventPosition(wrapper, eventEl, event);
    }
  }

  private handleMouseUp() {
    if (!this.draggedEvent) return;

    // Handle vertical reordering completion
    if (this.draggedEvent.type === 'move') {
      this.handleReorderEnd();

      const wrapper = this.eventsContainer.querySelector(`[data-id="${this.draggedEvent.id}"]`) as HTMLElement;
      const eventEl = wrapper?.querySelector('.timeline-event') as HTMLElement;
      eventEl?.classList.remove('dragging');
      eventEl?.classList.remove('reordering');

      this.draggedEvent = null;
      return;
    }

    // Handle horizontal timeline dragging completion (resize only)
    const event = this.events.find(ev => ev.id === this.draggedEvent!.id);

    if (event) {
      // Apply snapping based on resize type
      if (this.draggedEvent.type === 'resize-left') {
        // Snap start date to beginning of month
        event.startDate = this.snapToStartOfMonth(event.startDate);
      }

      if (this.draggedEvent.type === 'resize-right' && event.endDate !== null) {
        // Snap end date to end of month (only if end date exists)
        event.endDate = this.snapToEndOfMonth(event.endDate);
      }

      // Ensure start is before end after snapping (only if end date exists)
      if (event.endDate !== null && event.startDate >= event.endDate) {
        // If snapping caused overlap, adjust end date to end of start date's month
        event.endDate = this.snapToEndOfMonth(event.startDate);
      }

      // Update the visual position after snapping
      const wrapper = this.eventsContainer.querySelector(`[data-id="${this.draggedEvent.id}"]`) as HTMLElement;
      const eventEl = wrapper?.querySelector('.timeline-event') as HTMLElement;
      if (wrapper && eventEl) {
        this.updateEventPosition(wrapper, eventEl, event);
      }
    }

    const wrapper = this.eventsContainer.querySelector(`[data-id="${this.draggedEvent.id}"]`) as HTMLElement;
    const eventEl = wrapper?.querySelector('.timeline-event') as HTMLElement;
    eventEl?.classList.remove('dragging');
    this.draggedEvent = null;
    this.saveEvents();
  }

  private deleteEvent(id: number) {
    this.events = this.events.filter(e => e.id !== id);
    const wrapper = this.eventsContainer.querySelector(`[data-id="${id}"]`);
    wrapper?.remove();
    if (this.selectedEventId === id) {
      this.selectedEventId = null;
    }
    this.saveEvents();
  }

  private selectEvent(id: number) {
    // Deselect previous
    if (this.selectedEventId !== null) {
      const prevWrapper = this.eventsContainer.querySelector(`[data-id="${this.selectedEventId}"]`);
      prevWrapper?.classList.remove('selected');
    }

    // Select new
    this.selectedEventId = id;
    const wrapper = this.eventsContainer.querySelector(`[data-id="${id}"]`);
    wrapper?.classList.add('selected');
  }

  private toggleEndDate(id: number) {
    const event = this.events.find(e => e.id === id);
    if (!event) return;

    const oldWrapper = this.eventsContainer.querySelector(`[data-id="${id}"]`) as HTMLElement;
    const wasSelected = this.selectedEventId === id;

    // Store the next sibling to preserve position
    const nextSibling = oldWrapper?.nextElementSibling;

    if (event.endDate === null) {
      // Set end date to end of current month
      event.endDate = this.snapToEndOfMonth(new Date());
    } else {
      // Clear end date
      event.endDate = null;
    }

    // Remove old wrapper and re-render
    if (oldWrapper) {
      oldWrapper.remove();

      // Temporarily append to get the new wrapper
      this.renderEvent(event);
      const newWrapper = this.eventsContainer.querySelector(`[data-id="${id}"]`) as HTMLElement;

      // Move to original position
      if (newWrapper) {
        if (nextSibling) {
          this.eventsContainer.insertBefore(newWrapper, nextSibling);
        }
        // If there was no next sibling, it's already at the end which is correct

        // Restore selection if it was selected
        if (wasSelected) {
          newWrapper.classList.add('selected');
        }
      }
    }

    this.saveEvents();
  }

  private applyEventColor(eventEl: HTMLElement, color: string) {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;

    eventEl.style.setProperty('--event-color-r', rgb.r.toString());
    eventEl.style.setProperty('--event-color-g', rgb.g.toString());
    eventEl.style.setProperty('--event-color-b', rgb.b.toString());
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  private toggleColorPicker(id: number) {
    const wrapper = this.eventsContainer.querySelector(`[data-id="${id}"]`) as HTMLElement;
    const colorPicker = wrapper?.querySelector('.color-picker') as HTMLElement;

    if (!colorPicker) return;

    // Close all other color pickers
    document.querySelectorAll('.color-picker.show').forEach(picker => {
      if (picker !== colorPicker) {
        picker.classList.remove('show');
      }
    });

    colorPicker.classList.toggle('show');
  }

  private changeEventColor(id: number, color: string) {
    const event = this.events.find(e => e.id === id);
    if (!event) return;

    event.color = color;

    const wrapper = this.eventsContainer.querySelector(`[data-id="${id}"]`) as HTMLElement;
    const eventEl = wrapper?.querySelector('.timeline-event') as HTMLElement;
    const colorPicker = wrapper?.querySelector('.color-picker') as HTMLElement;

    if (eventEl) {
      eventEl.dataset.color = color;
      this.applyEventColor(eventEl, color);
    }

    // Update selected color option
    if (colorPicker) {
      colorPicker.querySelectorAll('.color-option').forEach(option => {
        const optionEl = option as HTMLElement;
        if (optionEl.style.backgroundColor === color || this.rgbToHex(optionEl.style.backgroundColor) === color) {
          optionEl.classList.add('selected');
        } else {
          optionEl.classList.remove('selected');
        }
      });
      colorPicker.classList.remove('show');
    }

    this.saveEvents();
  }

  private rgbToHex(rgb: string): string {
    const result = rgb.match(/\d+/g);
    if (!result || result.length < 3) return '';
    const r = parseInt(result[0]);
    const g = parseInt(result[1]);
    const b = parseInt(result[2]);
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('').toUpperCase();
  }

  private handleReorderMove(e: MouseEvent) {
    if (!this.draggedEvent) return;

    const wrapper = this.eventsContainer.querySelector(`[data-id="${this.draggedEvent.id}"]`) as HTMLElement;
    if (!wrapper) return;

    // Add reordering class for visual feedback
    wrapper.classList.add('reordering');

    // Get all event wrappers
    const wrappers = Array.from(this.eventsContainer.querySelectorAll('.timeline-event-wrapper')) as HTMLElement[];
    const currentIndex = wrappers.indexOf(wrapper);

    // Find which wrapper the mouse is over
    const mouseY = e.clientY;
    let targetIndex = currentIndex;

    for (let i = 0; i < wrappers.length; i++) {
      if (wrappers[i] === wrapper) continue;

      const rect = wrappers[i].getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;

      if (mouseY < midpoint && i < currentIndex) {
        targetIndex = i;
        break;
      } else if (mouseY > midpoint && i > currentIndex) {
        targetIndex = i;
      }
    }

    // Reorder in DOM if position changed
    if (targetIndex !== currentIndex) {
      if (targetIndex < currentIndex) {
        wrappers[targetIndex].insertAdjacentElement('beforebegin', wrapper);
      } else {
        wrappers[targetIndex].insertAdjacentElement('afterend', wrapper);
      }
    }
  }

  private handleReorderEnd() {
    if (!this.draggedEvent) return;

    const wrapper = this.eventsContainer.querySelector(`[data-id="${this.draggedEvent.id}"]`) as HTMLElement;
    wrapper?.classList.remove('reordering');

    // Update events array to match DOM order
    const wrappers = Array.from(this.eventsContainer.querySelectorAll('.timeline-event-wrapper')) as HTMLElement[];
    const newOrder: TimelineEvent[] = [];

    wrappers.forEach(w => {
      const id = parseInt(w.dataset.id || '0', 10);
      const event = this.events.find(e => e.id === id);
      if (event) {
        newOrder.push(event);
      }
    });

    this.events = newOrder;
  }

  private handleDocumentClick(e: MouseEvent) {
    const target = e.target as HTMLElement;

    // Close color pickers if clicking outside
    if (!target.closest('.color-picker') && !target.closest('.color-button')) {
      document.querySelectorAll('.color-picker.show').forEach(picker => {
        picker.classList.remove('show');
      });
    }

    // Deselect if not clicking on the actual timeline event bar
    if (!target.closest('.timeline-event') && this.selectedEventId !== null) {
      const prevWrapper = this.eventsContainer.querySelector(`[data-id="${this.selectedEventId}"]`);
      prevWrapper?.classList.remove('selected');
      this.selectedEventId = null;
    }
  }

  private saveEvents() {
    const eventsData = this.events.map(event => ({
      id: event.id,
      name: event.name,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate ? event.endDate.toISOString() : null,
      color: event.color
    }));
    localStorage.setItem('timelineEvents', JSON.stringify(eventsData));
    localStorage.setItem('timelineNextId', this.nextId.toString());
  }

  private loadEvents() {
    const storedEvents = localStorage.getItem('timelineEvents');
    const storedNextId = localStorage.getItem('timelineNextId');

    if (storedNextId) {
      this.nextId = parseInt(storedNextId, 10);
    }

    if (storedEvents) {
      try {
        const eventsData = JSON.parse(storedEvents);
        this.events = eventsData.map((data: any) => ({
          id: data.id,
          name: data.name,
          startDate: new Date(data.startDate),
          endDate: data.endDate ? new Date(data.endDate) : null,
          color: data.color || this.colorPalette[0] // Default to blue if no color
        }));

        // Render all loaded events
        this.events.forEach(event => this.renderEvent(event));
      } catch (error) {
        console.error('Failed to load events from localStorage:', error);
      }
    }
  }

  private exportEvents() {
    const eventsData = this.events.map(event => ({
      id: event.id,
      name: event.name,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate ? event.endDate.toISOString() : null,
      color: event.color
    }));

    const dataStr = JSON.stringify(eventsData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `timeline-events-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private importEvents() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';

    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const eventsData = JSON.parse(event.target?.result as string);

          // Clear existing events
          this.eventsContainer.innerHTML = '';
          this.events = [];

          // Import new events
          eventsData.forEach((data: any) => {
            const event: TimelineEvent = {
              id: data.id,
              name: data.name,
              startDate: new Date(data.startDate),
              endDate: data.endDate ? new Date(data.endDate) : null,
              color: data.color || this.colorPalette[0]
            };
            this.events.push(event);
            this.renderEvent(event);
          });

          // Update nextId to be higher than any imported id
          const maxId = Math.max(...this.events.map(e => e.id), 0);
          this.nextId = maxId + 1;

          this.saveEvents();
          alert('Events imported successfully!');
        } catch (error) {
          console.error('Failed to import events:', error);
          alert('Failed to import events. Please check the file format.');
        }
      };
      reader.readAsText(file);
    };

    input.click();
  }

  private async downloadAsImage() {
    const timelineContainer = document.querySelector('.timeline-container') as HTMLElement;
    if (!timelineContainer) {
      alert('Timeline not found!');
      return;
    }

    try {
      // Hide UI elements that shouldn't be in the image
      const elementsToHide = timelineContainer.querySelectorAll(
        '.delete-button, .color-button, .clear-end-button, .color-picker, .timeline-event-handle'
      );
      elementsToHide.forEach(el => (el as HTMLElement).style.display = 'none');

      // Remove selected state temporarily
      const selectedElements = timelineContainer.querySelectorAll('.selected');
      selectedElements.forEach(el => el.classList.remove('selected'));

      // Capture the timeline
      const canvas = await html2canvas(timelineContainer, {
        backgroundColor: '#000000',
        scale: 2, // Higher resolution
        logging: false,
        useCORS: true
      });

      // Restore hidden elements
      elementsToHide.forEach(el => (el as HTMLElement).style.display = '');

      // Restore selected state
      if (this.selectedEventId !== null) {
        const wrapper = this.eventsContainer.querySelector(`[data-id="${this.selectedEventId}"]`);
        wrapper?.classList.add('selected');
      }

      // Convert canvas to blob and download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `timeline-${new Date().toISOString().split('T')[0]}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      }, 'image/png');
    } catch (error) {
      console.error('Failed to download image:', error);
      alert('Failed to download image. Please try again.');

      // Restore hidden elements in case of error
      const elementsToHide = timelineContainer.querySelectorAll(
        '.delete-button, .color-button, .clear-end-button, .color-picker, .timeline-event-handle'
      );
      elementsToHide.forEach(el => (el as HTMLElement).style.display = '');

      // Restore selected state
      if (this.selectedEventId !== null) {
        const wrapper = this.eventsContainer.querySelector(`[data-id="${this.selectedEventId}"]`);
        wrapper?.classList.add('selected');
      }
    }
  }
}

// Initialize the timeline
new Timeline();

//TIP To find text strings in your project, you can use the <shortcut actionId="FindInPath"/> shortcut. Press it and type in <b>counter</b> – you’ll get all matches in one place.
//setupCounter(document.getElementById('counter-value') as HTMLElement);

//TIP There's much more in WebStorm to help you be more productive. Press <shortcut actionId="Shift"/> <shortcut actionId="Shift"/> and search for <b>Learn WebStorm</b> to open our learning hub with more things for you to try.
