import { isShortEvent, TimelineEvent } from '../events';
import {
  createEventElement,
  findDateDisplayElements,
  findEventElement,
  findEventWrapper,
  renderBreaks,
  updateDateDisplays
} from '../dom';
import { calculateDuration, formatDateRange, timeToZoomedPosition } from '../utils';

/**
 * Handles rendering of timeline events and visual updates.
 */
export class EventRenderer {
  constructor(
    private eventsContainer: HTMLElement,
    private getTimelineParams: () => {
      timelineStart: Date;
      timelineEnd: Date;
      zoomFactor: number;
    },
  ) {}

  /**
   * Renders a single event to the DOM.
   */
  renderEvent(
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
  ): void {
    const wrapper = createEventElement(event, handlers);
    this.eventsContainer.appendChild(wrapper);

    // Update position after wrapper is in DOM
    const eventEl = wrapper.querySelector('.timeline-event') as HTMLElement;
    this.updateEventPosition(wrapper, eventEl, event);
  }

  /**
   * Updates the visual position and styling of an event.
   */
  updateEventPosition(
    wrapper: HTMLElement,
    eventEl: HTMLElement,
    event: TimelineEvent,
  ): void {
    const { timelineStart, timelineEnd, zoomFactor } = this.getTimelineParams();
    const effectiveEndDate = event.endDate || new Date();

    // Calculate zoomed positions
    const startZoomedPos = timeToZoomedPosition(
      event.startDate.getTime(),
      timelineStart,
      timelineEnd,
      zoomFactor,
    );
    const endZoomedPos = timeToZoomedPosition(
      effectiveEndDate.getTime(),
      timelineStart,
      timelineEnd,
      zoomFactor,
    );

    const leftPercent = startZoomedPos * 100;
    const widthPercent = (endZoomedPos - startZoomedPos) * 100;

    eventEl.style.width = `${Math.max(widthPercent, 5)}%`;
    eventEl.style.marginLeft = `${Math.max(leftPercent, 0)}%`;
    wrapper.style.setProperty('--event-left', `${Math.max(leftPercent, 0)}%`);

    // Render breaks as overlays
    renderBreaks(eventEl, event);

    // Update classes
    if (event.endDate === null) {
      eventEl.classList.add('open-ended');
    } else {
      eventEl.classList.remove('open-ended');
    }

    if (isShortEvent(event)) {
      wrapper.classList.add('short-event');
    } else {
      wrapper.classList.remove('short-event');
    }

    // Update date displays
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

  /**
   * Updates all event positions (used when timeline range changes).
   */
  updateAllEventPositions(events: TimelineEvent[]): void {
    const wrappers = Array.from(
      this.eventsContainer.querySelectorAll('.timeline-event-wrapper'),
    ) as HTMLElement[];

    wrappers.forEach((wrapper) => {
      const id = parseInt(wrapper.dataset.id || '0', 10);
      const event = events.find((e) => e.id === id);
      const eventEl = findEventElement(wrapper);
      if (event && eventEl) {
        this.updateEventPosition(wrapper, eventEl, event);
      }
    });
  }

  /**
   * Clears all events from the container.
   */
  clearAllEvents(): void {
    this.eventsContainer.innerHTML = '';
  }

  /**
   * Finds a wrapper and event element by ID.
   */
  findEventElements(id: number): {
    wrapper: HTMLElement | null;
    eventEl: HTMLElement | null;
  } {
    const wrapper = findEventWrapper(this.eventsContainer, id);
    const eventEl = wrapper ? findEventElement(wrapper) : null;
    return { wrapper, eventEl };
  }
}
