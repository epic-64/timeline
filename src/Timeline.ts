// Event-related imports
import {
  TimelineEvent,
  createNewEvent,
  findEventById,
  removeEventById,
  isShortEvent,
  loadEventsFromLocalStorage,
  saveEventsToLocalStorage,
  exportEventsToFile,
  importEventsFromFile,
} from './events';

// Utility imports
import {
  calculateDuration,
  formatDateRange,
  snapToEndOfMonth,
  snapToStartOfMonth,
  timeToZoomedPosition,
  zoomedPositionToTime,
  applyEventColor,
  rgbToHex,
  loadTimelineStartDate,
  loadTimelineEndDate,
  saveTimelineStartYear,
  saveTimelineEndDate,
  isValidYear,
  formatDateForInput,
  createYearMarkers,
} from './utils';

// DOM-related imports
import {
  createEventElement,
  renderBreaks,
  findEventWrapper,
  findEventElement,
  getAllEventWrappers,
  addClassToElement,
  removeClassFromElement,
  closeAllColorPickersExcept,
  findColorPicker,
  findDateDisplayElements,
  updateDateDisplays,
  openBreaksDialog,
  downloadTimelineAsImage,
} from './dom';

export class Timeline {
  private events: TimelineEvent[] = [];
  private nextId = 1;
  private eventsContainer: HTMLElement;
  private datesContainer: HTMLElement;
  private draggedEvent: {
    id: number;
    type: 'move' | 'resize-left' | 'resize-right';
  } | null = null;
  private dragStartX = 0;
  private selectedEventId: number | null = null;

  // Timeline spans 12 months from today
  private timelineStart: Date;
  private timelineEnd: Date;

  // Zoom factor: higher values give more weight to recent years
  // 0 = linear (no zoom), 1 = moderate zoom, 2 = strong zoom
  private zoomFactor = 1.5;

  constructor() {
    this.eventsContainer = document.getElementById(
      'timeline-events',
    ) as HTMLElement;
    this.datesContainer = document.getElementById(
      'timeline-dates',
    ) as HTMLElement;

    // Load saved settings or use defaults
    this.timelineStart = loadTimelineStartDate();
    this.timelineEnd = loadTimelineEndDate();

    this.setupEventListeners();
    this.initializeInputFields();
    this.renderDateHeader();
    this.loadEvents();
  }

  private setupEventListeners() {
    document
      .getElementById('addEvent')
      ?.addEventListener('click', () => this.addEvent());
    document
      .getElementById('exportEvents')
      ?.addEventListener('click', () => this.exportEvents());
    document
      .getElementById('importEvents')
      ?.addEventListener('click', () => this.importEvents());
    document
      .getElementById('downloadImage')
      ?.addEventListener('click', () => this.downloadAsImage());

    document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    document.addEventListener('mouseup', () => this.handleMouseUp());
    document.addEventListener('click', (e) => this.handleDocumentClick(e));
  }

  private initializeInputFields() {
    const startYearInput = document.getElementById(
      'startYear',
    ) as HTMLInputElement;
    const endDateInput = document.getElementById('endDate') as HTMLInputElement;

    if (startYearInput) {
      startYearInput.value = this.timelineStart.getFullYear().toString();
      startYearInput.addEventListener('change', (e) => {
        const year = parseInt((e.target as HTMLInputElement).value);
        if (year && isValidYear(year)) {
          this.timelineStart = new Date(year, 0, 1);
          saveTimelineStartYear(year);
          this.refreshTimeline();
        }
      });
    }

    if (endDateInput) {
      endDateInput.value = formatDateForInput(this.timelineEnd);

      endDateInput.addEventListener('change', (e) => {
        const dateStr = (e.target as HTMLInputElement).value;
        if (dateStr) {
          this.timelineEnd = new Date(dateStr);
          saveTimelineEndDate(this.timelineEnd);
          this.refreshTimeline();
        }
      });
    }
  }

  private refreshTimeline() {
    // Re-render date header
    this.renderDateHeader();

    // Re-render all events with new positions
    const wrappers = getAllEventWrappers(this.eventsContainer);
    wrappers.forEach((wrapper) => {
      const id = parseInt(wrapper.dataset.id || '0', 10);
      const event = findEventById(this.events, id);
      const eventEl = findEventElement(wrapper);
      if (event && eventEl) {
        this.updateEventPosition(wrapper, eventEl, event);
      }
    });
  }

  private renderDateHeader() {
    this.datesContainer.innerHTML = '';
    const startYear = this.timelineStart.getFullYear();
    const endYear = this.timelineEnd.getFullYear();

    // Create markers for each year with zoomed positioning
    const markers = createYearMarkers(startYear, endYear, (yearDate) =>
      timeToZoomedPosition(
        yearDate.getTime(),
        this.timelineStart,
        this.timelineEnd,
        this.zoomFactor,
      ),
    );

    markers.forEach((marker) => this.datesContainer.appendChild(marker));
  }

  addEvent() {
    const event = createNewEvent(
      this.nextId++,
      this.timelineStart,
      this.timelineEnd,
    );

    this.events.push(event);
    this.renderEvent(event);
    this.saveEvents();
  }

  private renderEvent(event: TimelineEvent) {
    const wrapper = createEventElement(event, {
      onNameEdit: (newName) => {
        event.name = newName;
        this.saveEvents();
      },
      onResizeLeft: (e) => this.startResize(e, event.id, 'resize-left'),
      onResizeRight: (e) => this.startResize(e, event.id, 'resize-right'),
      onToggleEndDate: (e) => {
        e.stopPropagation();
        this.toggleEndDate(event.id);
      },
      onToggleColorPicker: (e) => {
        e.stopPropagation();
        this.toggleColorPicker(event.id);
      },
      onChangeColor: (color) => this.changeEventColor(event.id, color),
      onDelete: (e) => {
        e.stopPropagation();
        this.deleteEvent(event.id);
      },
      onOpenBreaks: (e) => {
        e.stopPropagation();
        this.openBreaksDialog(event.id);
      },
      onSelect: (e) => {
        e.stopPropagation();
        this.selectEvent(event.id);
      },
      onStartVerticalReorder: (e) => this.startVerticalReorder(e, event.id),
    });

    this.eventsContainer.appendChild(wrapper);

    // Now update position after wrapper is in DOM
    const eventEl = wrapper.querySelector('.timeline-event') as HTMLElement;
    this.updateEventPosition(wrapper, eventEl, event);
  }

  private updateEventPosition(
    wrapper: HTMLElement,
    eventEl: HTMLElement,
    event: TimelineEvent,
  ) {
    // If no end date, use today's date for visualization
    const effectiveEndDate = event.endDate || new Date();

    // Calculate zoomed positions
    const startZoomedPos = timeToZoomedPosition(
      event.startDate.getTime(),
      this.timelineStart,
      this.timelineEnd,
      this.zoomFactor,
    );
    const endZoomedPos = timeToZoomedPosition(
      effectiveEndDate.getTime(),
      this.timelineStart,
      this.timelineEnd,
      this.zoomFactor,
    );

    const leftPercent = startZoomedPos * 100;
    const widthPercent = (endZoomedPos - startZoomedPos) * 100;

    eventEl.style.width = `${Math.max(widthPercent, 5)}%`;
    eventEl.style.marginLeft = `${Math.max(leftPercent, 0)}%`;

    // Set CSS variable for external date positioning
    wrapper.style.setProperty('--event-left', `${Math.max(leftPercent, 0)}%`);

    // Render breaks as overlays
    renderBreaks(eventEl, event);

    // Update or add open-ended class
    if (event.endDate === null) {
      eventEl.classList.add('open-ended');
    } else {
      eventEl.classList.remove('open-ended');
    }

    // Toggle short-event class and date display
    if (isShortEvent(event)) {
      wrapper.classList.add('short-event');
    } else {
      wrapper.classList.remove('short-event');
    }

    // Update both date displays
    const { datesEl, externalDatesEl } = findDateDisplayElements(
      wrapper,
      eventEl,
    );
    const dateText = formatDateRange(event.startDate, event.endDate);
    const durationText = calculateDuration(
      event.startDate,
      event.endDate,
      event.breaks,
    );
    const fullText = `${dateText}<br><span class="duration">${durationText}</span>`;

    updateDateDisplays(datesEl, externalDatesEl, fullText);
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

    const wrapper = findEventWrapper(this.eventsContainer, id);
    const eventEl = wrapper ? findEventElement(wrapper) : null;
    addClassToElement(eventEl, 'reordering');
  }

  private startResize(
    e: MouseEvent,
    id: number,
    type: 'resize-left' | 'resize-right',
  ) {
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
    const event = findEventById(this.events, this.draggedEvent.id);
    if (!event) return;

    const deltaX = e.clientX - this.dragStartX;
    const containerWidth = this.eventsContainer.offsetWidth;

    // Calculate current zoomed position and new zoomed position
    const currentZoomedPos = timeToZoomedPosition(
      this.draggedEvent.type === 'resize-left'
        ? event.startDate.getTime()
        : event.endDate
          ? event.endDate.getTime()
          : event.startDate.getTime(),
      this.timelineStart,
      this.timelineEnd,
      this.zoomFactor,
    );

    const deltaZoomedPos = deltaX / containerWidth;
    const newZoomedPos = currentZoomedPos + deltaZoomedPos;

    // Convert back to timestamp
    const newTimestamp = zoomedPositionToTime(
      newZoomedPos,
      this.timelineStart,
      this.timelineEnd,
      this.zoomFactor,
    );

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

    const wrapper = findEventWrapper(this.eventsContainer, this.draggedEvent.id);
    const eventEl = wrapper ? findEventElement(wrapper) : null;
    if (wrapper && eventEl) {
      this.updateEventPosition(wrapper, eventEl, event);
    }
  }

  private handleMouseUp() {
    if (!this.draggedEvent) return;

    // Handle vertical reordering completion
    if (this.draggedEvent.type === 'move') {
      this.handleReorderEnd();

      const wrapper = findEventWrapper(this.eventsContainer, this.draggedEvent.id);
      const eventEl = wrapper ? findEventElement(wrapper) : null;
      removeClassFromElement(eventEl, 'dragging');
      removeClassFromElement(eventEl, 'reordering');

      this.draggedEvent = null;
      return;
    }

    // Handle horizontal timeline dragging completion (resize only)
    const event = findEventById(this.events, this.draggedEvent.id);

    if (event) {
      // Apply snapping based on resize type
      if (this.draggedEvent.type === 'resize-left') {
        // Snap start date to beginning of month
        event.startDate = snapToStartOfMonth(event.startDate);
      }

      if (this.draggedEvent.type === 'resize-right' && event.endDate !== null) {
        // Snap end date to end of month (only if end date exists)
        event.endDate = snapToEndOfMonth(event.endDate);
      }

      // Ensure start is before end after snapping (only if end date exists)
      if (event.endDate !== null && event.startDate >= event.endDate) {
        // If snapping caused overlap, adjust end date to end of start date's month
        event.endDate = snapToEndOfMonth(event.startDate);
      }

      // Update the visual position after snapping
      const wrapper = findEventWrapper(this.eventsContainer, this.draggedEvent.id);
      const eventEl = wrapper ? findEventElement(wrapper) : null;
      if (wrapper && eventEl) {
        this.updateEventPosition(wrapper, eventEl, event);
      }
    }

    const wrapper = findEventWrapper(this.eventsContainer, this.draggedEvent.id);
    const eventEl = wrapper ? findEventElement(wrapper) : null;
    removeClassFromElement(eventEl, 'dragging');
    this.draggedEvent = null;
    this.saveEvents();
  }

  private deleteEvent(id: number) {
    this.events = removeEventById(this.events, id);
    const wrapper = findEventWrapper(this.eventsContainer, id);
    wrapper?.remove();
    if (this.selectedEventId === id) {
      this.selectedEventId = null;
    }
    this.saveEvents();
  }

  private selectEvent(id: number) {
    // Deselect previous
    if (this.selectedEventId !== null) {
      const prevWrapper = this.eventsContainer.querySelector(
        `[data-id="${this.selectedEventId}"]`,
      );
      prevWrapper?.classList.remove('selected');
    }

    // Select new
    this.selectedEventId = id;
    const wrapper = this.eventsContainer.querySelector(`[data-id="${id}"]`);
    wrapper?.classList.add('selected');
  }

  private toggleEndDate(id: number) {
    const event = this.events.find((e) => e.id === id);
    if (!event) return;

    const oldWrapper = this.eventsContainer.querySelector(
      `[data-id="${id}"]`,
    ) as HTMLElement;
    const wasSelected = this.selectedEventId === id;

    // Store the next sibling to preserve position
    const nextSibling = oldWrapper?.nextElementSibling;

    if (event.endDate === null) {
      // Set end date to end of current month
      event.endDate = snapToEndOfMonth(new Date());
    } else {
      // Clear end date
      event.endDate = null;
    }

    // Remove old wrapper and re-render
    if (oldWrapper) {
      oldWrapper.remove();

      // Temporarily append to get the new wrapper
      this.renderEvent(event);
      const newWrapper = this.eventsContainer.querySelector(
        `[data-id="${id}"]`,
      ) as HTMLElement;

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

  private toggleColorPicker(id: number) {
    const wrapper = findEventWrapper(this.eventsContainer, id);
    const colorPicker = wrapper ? findColorPicker(wrapper) : null;

    if (!colorPicker) return;

    // Close all other color pickers
    closeAllColorPickersExcept(colorPicker);

    colorPicker.classList.toggle('show');
  }

  private changeEventColor(id: number, color: string) {
    const event = findEventById(this.events, id);
    if (!event) return;

    event.color = color;

    const wrapper = findEventWrapper(this.eventsContainer, id);
    const eventEl = wrapper ? findEventElement(wrapper) : null;
    const colorPicker = wrapper ? findColorPicker(wrapper) : null;

    if (eventEl) {
      eventEl.dataset.color = color;
      applyEventColor(eventEl, color);
    }

    // Update selected color option
    if (colorPicker) {
      colorPicker.querySelectorAll('.color-option').forEach((option) => {
        const optionEl = option as HTMLElement;
        if (
          optionEl.style.backgroundColor === color ||
          rgbToHex(optionEl.style.backgroundColor) === color
        ) {
          optionEl.classList.add('selected');
        } else {
          optionEl.classList.remove('selected');
        }
      });
      colorPicker.classList.remove('show');
    }

    this.saveEvents();
  }

  private openBreaksDialog(id: number) {
    const event = findEventById(this.events, id);
    if (!event) return;

    openBreaksDialog(event, () => this.updateEventAfterBreaksChange(id));
  }

  private updateEventAfterBreaksChange(id: number) {
    const event = findEventById(this.events, id);
    if (!event) return;

    const wrapper = findEventWrapper(this.eventsContainer, id);
    const eventEl = wrapper ? findEventElement(wrapper) : null;

    if (wrapper && eventEl) {
      this.updateEventPosition(wrapper, eventEl, event);
    }

    this.saveEvents();
  }

  private handleReorderMove(e: MouseEvent) {
    if (!this.draggedEvent) return;

    const wrapper = this.eventsContainer.querySelector(
      `[data-id="${this.draggedEvent.id}"]`,
    ) as HTMLElement;
    if (!wrapper) return;

    // Add reordering class for visual feedback
    wrapper.classList.add('reordering');

    // Get all event wrappers
    const wrappers = Array.from(
      this.eventsContainer.querySelectorAll('.timeline-event-wrapper'),
    ) as HTMLElement[];
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

    const wrapper = this.eventsContainer.querySelector(
      `[data-id="${this.draggedEvent.id}"]`,
    ) as HTMLElement;
    wrapper?.classList.remove('reordering');

    // Update events array to match DOM order
    const wrappers = Array.from(
      this.eventsContainer.querySelectorAll('.timeline-event-wrapper'),
    ) as HTMLElement[];
    const newOrder: TimelineEvent[] = [];

    wrappers.forEach((w) => {
      const id = parseInt(w.dataset.id || '0', 10);
      const event = this.events.find((e) => e.id === id);
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
      document.querySelectorAll('.color-picker.show').forEach((picker) => {
        picker.classList.remove('show');
      });
    }

    // Deselect if not clicking on the actual timeline event bar
    if (!target.closest('.timeline-event') && this.selectedEventId !== null) {
      const prevWrapper = this.eventsContainer.querySelector(
        `[data-id="${this.selectedEventId}"]`,
      );
      prevWrapper?.classList.remove('selected');
      this.selectedEventId = null;
    }
  }

  private saveEvents() {
    saveEventsToLocalStorage(this.events, this.nextId);
  }

  private loadEvents() {
    const { events, nextId } = loadEventsFromLocalStorage();
    this.events = events;
    this.nextId = nextId;

    // Render all loaded events
    this.events.forEach((event) => this.renderEvent(event));
  }

  private exportEvents() {
    exportEventsToFile(this.events);
  }

  private async importEvents() {
    try {
      const { events, nextId } = await importEventsFromFile();

      // Clear existing events
      this.eventsContainer.innerHTML = '';
      this.events = [];

      // Import new events
      events.forEach((event) => {
        this.events.push(event);
        this.renderEvent(event);
      });

      this.nextId = nextId;
      this.saveEvents();
      alert('Events imported successfully!');
    } catch (error) {
      console.error('Failed to import events:', error);
      alert('Failed to import events. Please check the file format.');
    }
  }

  private async downloadAsImage() {
    await downloadTimelineAsImage('.timeline-container', this.selectedEventId);
  }
}

