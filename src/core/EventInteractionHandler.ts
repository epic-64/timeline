import { TimelineEvent } from '../events';
import {
  applyEventColor,
  rgbToHex,
  snapToEndOfMonth,
  snapToStartOfMonth,
  timeToZoomedPosition,
  zoomedPositionToTime
} from '../utils';
import {
  addClassToElement,
  closeAllColorPickersExcept,
  findColorPicker,
  findEventElement,
  findEventWrapper,
  removeClassFromElement
} from '../dom';
import { EventRenderer } from './EventRenderer';
import { EventStateProvider } from './EventStateProvider';

/**
 * Handles all user interactions with timeline events.
 * Uses EventStateProvider interface to avoid bidirectional coupling.
 */
export class EventInteractionHandler {
  private draggedEvent: {
    id: number;
    type: 'move' | 'resize-left' | 'resize-right';
  } | null = null;
  private dragStartX = 0;
  private selectedEventId: number | null = null;

  constructor(
    private eventsContainer: HTMLElement,
    private eventRenderer: EventRenderer,
    private eventStateProvider: EventStateProvider,
    private getTimelineParams: () => {
      timelineStart: Date;
      timelineEnd: Date;
      zoomFactor: number;
    },
    private onEventsChange: () => void,
  ) {
    this.setupGlobalListeners();
  }

  /**
   * Starts a vertical reorder operation.
   */
  startVerticalReorder(e: MouseEvent, id: number): void {
    const target = e.target as HTMLElement;

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

  /**
   * Starts a resize operation.
   */
  startResize(
    e: MouseEvent,
    id: number,
    type: 'resize-left' | 'resize-right',
  ): void {
    e.preventDefault();
    e.stopPropagation();

    this.draggedEvent = { id, type };
    this.dragStartX = e.clientX;
  }

  /**
   * Selects an event.
   */
  selectEvent(id: number): void {
    if (this.selectedEventId !== null) {
      const prevWrapper = this.eventsContainer.querySelector(
        `[data-id="${this.selectedEventId}"]`,
      );
      prevWrapper?.classList.remove('selected');
    }

    this.selectedEventId = id;
    const wrapper = this.eventsContainer.querySelector(`[data-id="${id}"]`);
    wrapper?.classList.add('selected');
  }

  /**
   * Toggles the color picker for an event.
   */
  toggleColorPicker(id: number): void {
    const wrapper = findEventWrapper(this.eventsContainer, id);
    const colorPicker = wrapper ? findColorPicker(wrapper) : null;

    if (!colorPicker) return;

    closeAllColorPickersExcept(colorPicker);
    colorPicker.classList.toggle('show');
  }

  /**
   * Changes an event's color.
   */
  changeEventColor(id: number, color: string): void {
    const event = this.eventStateProvider.getEventById(id);
    if (!event) return;

    // Update the event through the state provider
    this.eventStateProvider.updateEvent(id, { color });

    const wrapper = findEventWrapper(this.eventsContainer, id);
    const eventEl = wrapper ? findEventElement(wrapper) : null;
    const colorPicker = wrapper ? findColorPicker(wrapper) : null;

    if (eventEl) {
      eventEl.dataset.color = color;
      applyEventColor(eventEl, color);
    }

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

    this.onEventsChange();
  }

  getSelectedEventId(): number | null {
    return this.selectedEventId;
  }


  private setupGlobalListeners(): void {
    document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    document.addEventListener('mouseup', () => this.handleMouseUp());
    document.addEventListener('click', (e) => this.handleDocumentClick(e));
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.draggedEvent) return;

    if (this.draggedEvent.type === 'move') {
      this.handleReorderMove(e);
      return;
    }

    // Handle resize
    this.handleResize(e);
  }

  private handleResize(e: MouseEvent): void {
    const event = this.eventStateProvider.getEventById(this.draggedEvent!.id);
    if (!event) return;

    const { timelineStart, timelineEnd, zoomFactor } = this.getTimelineParams();
    const deltaX = e.clientX - this.dragStartX;
    const containerWidth = this.eventsContainer.offsetWidth;

    const currentZoomedPos = timeToZoomedPosition(
      this.draggedEvent!.type === 'resize-left'
        ? event.startDate.getTime()
        : event.endDate
          ? event.endDate.getTime()
          : event.startDate.getTime(),
      timelineStart,
      timelineEnd,
      zoomFactor,
    );

    const deltaZoomedPos = deltaX / containerWidth;
    const newZoomedPos = currentZoomedPos + deltaZoomedPos;
    const newTimestamp = zoomedPositionToTime(
      newZoomedPos,
      timelineStart,
      timelineEnd,
      zoomFactor,
    );

    if (this.draggedEvent!.type === 'resize-left') {
      const newStart = new Date(newTimestamp);
      const compareDate = event.endDate || new Date();
      if (newStart < compareDate) {
        this.eventStateProvider.updateEvent(event.id, { startDate: newStart });
      }
    } else if (this.draggedEvent!.type === 'resize-right') {
      if (event.endDate !== null) {
        const newEnd = new Date(newTimestamp);
        if (newEnd > event.startDate) {
          this.eventStateProvider.updateEvent(event.id, { endDate: newEnd });
        }
      }
    }

    this.dragStartX = e.clientX;

    const { wrapper, eventEl } = this.eventRenderer.findEventElements(
      this.draggedEvent!.id,
    );
    if (wrapper && eventEl) {
      // Get updated event to render
      const updatedEvent = this.eventStateProvider.getEventById(this.draggedEvent!.id);
      if (updatedEvent) {
        this.eventRenderer.updateEventPosition(wrapper, eventEl, updatedEvent);
      }
    }
  }

  private handleReorderMove(e: MouseEvent): void {
    if (!this.draggedEvent) return;

    const wrapper = this.eventsContainer.querySelector(
      `[data-id="${this.draggedEvent.id}"]`,
    ) as HTMLElement;
    if (!wrapper) return;

    wrapper.classList.add('reordering');

    const wrappers = Array.from(
      this.eventsContainer.querySelectorAll('.timeline-event-wrapper'),
    ) as HTMLElement[];
    const currentIndex = wrappers.indexOf(wrapper);
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

    if (targetIndex !== currentIndex) {
      if (targetIndex < currentIndex) {
        wrappers[targetIndex].insertAdjacentElement('beforebegin', wrapper);
      } else {
        wrappers[targetIndex].insertAdjacentElement('afterend', wrapper);
      }
    }
  }

  private handleMouseUp(): void {
    if (!this.draggedEvent) return;

    if (this.draggedEvent.type === 'move') {
      this.handleReorderEnd();
      const { eventEl } = this.eventRenderer.findEventElements(
        this.draggedEvent.id,
      );
      removeClassFromElement(eventEl, 'dragging');
      removeClassFromElement(eventEl, 'reordering');
      this.draggedEvent = null;
      return;
    }

    // Handle resize end with snapping
    const event = this.eventStateProvider.getEventById(this.draggedEvent.id);

    if (event) {
      const updates: Partial<TimelineEvent> = {};

      if (this.draggedEvent.type === 'resize-left') {
        updates.startDate = snapToStartOfMonth(event.startDate);
      }

      if (this.draggedEvent.type === 'resize-right' && event.endDate !== null) {
        updates.endDate = snapToEndOfMonth(event.endDate);
      }

      // Ensure end date is after start date
      const newStartDate = updates.startDate || event.startDate;
      const newEndDate = updates.endDate || event.endDate;
      
      if (newEndDate !== null && newStartDate >= newEndDate) {
        updates.endDate = snapToEndOfMonth(newStartDate);
      }

      // Apply updates
      if (Object.keys(updates).length > 0) {
        this.eventStateProvider.updateEvent(event.id, updates);
      }

      const { wrapper, eventEl } = this.eventRenderer.findEventElements(
        this.draggedEvent.id,
      );
      if (wrapper && eventEl) {
        const updatedEvent = this.eventStateProvider.getEventById(this.draggedEvent.id);
        if (updatedEvent) {
          this.eventRenderer.updateEventPosition(wrapper, eventEl, updatedEvent);
        }
      }
    }

    const { eventEl } = this.eventRenderer.findEventElements(
      this.draggedEvent.id,
    );
    removeClassFromElement(eventEl, 'dragging');
    this.draggedEvent = null;
    this.onEventsChange();
  }

  private handleReorderEnd(): void {
    if (!this.draggedEvent) return;

    const wrapper = this.eventsContainer.querySelector(
      `[data-id="${this.draggedEvent.id}"]`,
    ) as HTMLElement;
    wrapper?.classList.remove('reordering');

    // Get ordered IDs from DOM
    const wrappers = Array.from(
      this.eventsContainer.querySelectorAll('.timeline-event-wrapper'),
    ) as HTMLElement[];
    const orderedIds = wrappers
      .map((w) => parseInt(w.dataset.id || '0', 10))
      .filter((id) => id > 0);

    // Update events array through state provider
    this.eventStateProvider.reorderEventsFromDOM(orderedIds);
  }

  private handleDocumentClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;

    if (!target.closest('.color-picker') && !target.closest('.color-button')) {
      document.querySelectorAll('.color-picker.show').forEach((picker) => {
        picker.classList.remove('show');
      });
    }

    if (!target.closest('.timeline-event') && this.selectedEventId !== null) {
      const prevWrapper = this.eventsContainer.querySelector(
        `[data-id="${this.selectedEventId}"]`,
      );
      prevWrapper?.classList.remove('selected');
      this.selectedEventId = null;
    }
  }
}
