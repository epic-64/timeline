import { TimelineEvent } from '../events/types';

/**
 * Interface for accessing event state.
 * Allows EventInteractionHandler to query events without bidirectional coupling.
 */
export interface EventStateProvider {
  /**
   * Get an event by ID.
   */
  getEventById(id: number): TimelineEvent | undefined;

  /**
   * Get all events.
   */
  getAllEvents(): ReadonlyArray<TimelineEvent>;

  /**
   * Update an event's properties.
   */
  updateEvent(id: number, updates: Partial<TimelineEvent>): void;

  /**
   * Reorder events based on their current DOM order.
   */
  reorderEventsFromDOM(orderedIds: number[]): void;
}

