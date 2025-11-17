import { TimelineEvent } from '../events/types';
import {
  createNewEvent,
  exportEventsToFile,
  findEventById,
  importEventsFromFile,
  loadEventsFromLocalStorage,
  removeEventById,
  saveEventsToLocalStorage
} from '../events';
import { snapToEndOfMonth } from '../utils';
import { downloadTimelineAsImage, findEventWrapper, openBreaksDialog } from '../dom';
import { EventRenderer } from './EventRenderer';
import { EventInteractionHandler } from './EventInteractionHandler';
import { TimelineConfig } from './TimelineConfig';
import { EventStateProvider } from './EventStateProvider';

/**
 * Manages the state of timeline events and coordinates between components.
 * Implements EventStateProvider to provide event state to interaction handler.
 */
export class TimelineState implements EventStateProvider {
  private events: TimelineEvent[] = [];
  private nextId = 1;

  constructor(
    private eventsContainer: HTMLElement,
    private config: TimelineConfig,
    private renderer: EventRenderer,
    private interactionHandler: EventInteractionHandler,
  ) {
    // No need to wire up callbacks anymore - handler uses interface methods
  }

  /**
   * Loads events from storage and renders them.
   */
  loadEvents(): void {
    const { events, nextId } = loadEventsFromLocalStorage();
    this.events = events;
    this.nextId = nextId;

    this.events.forEach((event) => this.renderEvent(event));
  }

  // EventStateProvider interface implementation

  /**
   * Get an event by ID.
   */
  getEventById(id: number): TimelineEvent | undefined {
    return findEventById(this.events, id);
  }

  /**
   * Get all events (read-only).
   */
  getAllEvents(): ReadonlyArray<TimelineEvent> {
    return this.events;
  }

  /**
   * Update an event's properties.
   */
  updateEvent(id: number, updates: Partial<TimelineEvent>): void {
    const event = findEventById(this.events, id);
    if (!event) return;

    // Apply updates
    Object.assign(event, updates);
    this.saveEvents();
  }

  /**
   * Reorder events based on DOM order.
   */
  reorderEventsFromDOM(orderedIds: number[]): void {
    const newOrder: TimelineEvent[] = [];

    orderedIds.forEach((id) => {
      const event = findEventById(this.events, id);
      if (event) {
        newOrder.push(event);
      }
    });

    this.events = newOrder;
    this.saveEvents();
  }

  /**
   * Adds a new event to the timeline.
   */
  addEvent(): void {
    const event = createNewEvent(
      this.nextId++,
      this.config.getTimelineStart(),
      this.config.getTimelineEnd(),
    );

    this.events.push(event);
    this.renderEvent(event);
    this.saveEvents();
  }

  /**
   * Deletes an event by ID.
   */
  deleteEvent(id: number): void {
    this.events = removeEventById(this.events, id);
    const wrapper = findEventWrapper(this.eventsContainer, id);
    wrapper?.remove();
    this.saveEvents();
  }

  /**
   * Toggles the end date of an event (between null and current month end).
   */
  toggleEndDate(id: number): void {
    const event = this.events.find((e) => e.id === id);
    if (!event) return;

    const oldWrapper = this.eventsContainer.querySelector(
      `[data-id="${id}"]`,
    ) as HTMLElement;
    const wasSelected = this.interactionHandler.getSelectedEventId() === id;
    const nextSibling = oldWrapper?.nextElementSibling;

    if (event.endDate === null) {
      event.endDate = snapToEndOfMonth(new Date());
    } else {
      event.endDate = null;
    }

    if (oldWrapper) {
      oldWrapper.remove();
      this.renderEvent(event);
      const newWrapper = this.eventsContainer.querySelector(
        `[data-id="${id}"]`,
      ) as HTMLElement;

      if (newWrapper) {
        if (nextSibling) {
          this.eventsContainer.insertBefore(newWrapper, nextSibling);
        }
        if (wasSelected) {
          newWrapper.classList.add('selected');
        }
      }
    }

    this.saveEvents();
  }

  /**
   * Opens the breaks dialog for an event.
   */
  openBreaksDialog(id: number): void {
    const event = findEventById(this.events, id);
    if (!event) return;

    openBreaksDialog(event, () => this.updateEventAfterBreaksChange(id));
  }

  /**
   * Exports events to a JSON file.
   */
  exportEvents(): void {
    exportEventsToFile(this.events);
  }

  /**
   * Imports events from a JSON file.
   */
  async importEvents(): Promise<void> {
    try {
      const { events, nextId } = await importEventsFromFile();

      this.renderer.clearAllEvents();
      this.events = [];

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

  /**
   * Downloads the timeline as an image.
   */
  async downloadAsImage(): Promise<void> {
    await downloadTimelineAsImage(
      '.timeline-container',
      this.interactionHandler.getSelectedEventId(),
    );
  }

  /**
   * Refreshes all event positions (called when timeline range changes).
   */
  refreshAllEvents(): void {
    this.renderer.updateAllEventPositions(this.events);
  }

  /**
   * Updates an event's visual position after breaks change.
   */
  private updateEventAfterBreaksChange(id: number): void {
    const event = findEventById(this.events, id);
    if (!event) return;

    const { wrapper, eventEl } = this.renderer.findEventElements(id);
    if (wrapper && eventEl) {
      this.renderer.updateEventPosition(wrapper, eventEl, event);
    }

    this.saveEvents();
  }

  /**
   * Saves events to localStorage.
   */
  private saveEvents(): void {
    saveEventsToLocalStorage(this.events, this.nextId);
  }

  /**
   * Renders a single event with all its handlers.
   */
  private renderEvent(event: TimelineEvent): void {
    this.renderer.renderEvent(event, {
      onNameEdit: (newName) => {
        event.name = newName;
        this.saveEvents();
      },
      onResizeLeft: (e) =>
        this.interactionHandler.startResize(e, event.id, 'resize-left'),
      onResizeRight: (e) =>
        this.interactionHandler.startResize(e, event.id, 'resize-right'),
      onToggleEndDate: (e) => {
        e.stopPropagation();
        this.toggleEndDate(event.id);
      },
      onToggleColorPicker: (e) => {
        e.stopPropagation();
        this.interactionHandler.toggleColorPicker(event.id);
      },
      onChangeColor: (color) => {
        this.interactionHandler.changeEventColor(event.id, color);
      },
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
        this.interactionHandler.selectEvent(event.id);
      },
      onStartVerticalReorder: (e) => {
        this.interactionHandler.startVerticalReorder(e, event.id);
      },
    });
  }
}
