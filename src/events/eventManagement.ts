import { TimelineEvent } from './types';
import { COLOR_PALETTE } from '../utils';

/**
 * Creates a new timeline event with default values.
 */
export function createNewEvent(
  nextId: number,
  timelineStart: Date,
  timelineEnd: Date,
): TimelineEvent {
  // Calculate the middle of the timeline range
  const timelineSpan = timelineEnd.getTime() - timelineStart.getTime();
  const middleTimestamp = timelineStart.getTime() + timelineSpan / 2;

  const start = new Date(middleTimestamp);
  const end = new Date(middleTimestamp);

  // Add 3 years to the end date
  end.setFullYear(end.getFullYear() + 3);

  return {
    id: nextId,
    name: `Event ${nextId}`,
    startDate: start,
    endDate: end,
    color: COLOR_PALETTE[0], // Default blue
    breaks: [],
  };
}

/**
 * Finds an event by ID.
 */
export function findEventById(
  events: TimelineEvent[],
  id: number,
): TimelineEvent | undefined {
  console.log('findEventById: searching for id', id);
  console.log('events is array?', Array.isArray(events));
  console.log('events length:', events?.length);
  console.log('events:', events);

  if (!events || !Array.isArray(events)) {
    console.log('events is not a valid array!');
    return undefined;
  }

  const result = events.find((e) => {
    console.log(`Comparing e.id=${e.id} (${typeof e.id}) with id=${id} (${typeof id}), equal=${e.id === id}`);
    return e.id === id;
  });
  console.log('findEventById result:', result);
  return result;
}

/**
 * Removes an event from the events array by ID.
 */
export function removeEventById(
  events: TimelineEvent[],
  id: number,
): TimelineEvent[] {
  return events.filter((e) => e.id !== id);
}

/**
 * Updates the order of events to match the DOM order.
 */
export function updateEventOrder(
  events: TimelineEvent[],
  orderedIds: number[],
): TimelineEvent[] {
  const newOrder: TimelineEvent[] = [];

  orderedIds.forEach((id) => {
    const event = events.find((e) => e.id === id);
    if (event) {
      newOrder.push(event);
    }
  });

  return newOrder;
}

/**
 * Checks if an event is short (less than 2 years duration).
 */
export function isShortEvent(event: TimelineEvent): boolean {
  const effectiveEndDate = event.endDate || new Date();
  const eventDuration = effectiveEndDate.getTime() - event.startDate.getTime();
  const twoYearsInMs = 2 * 365.25 * 24 * 60 * 60 * 1000;
  return eventDuration < twoYearsInMs;
}
