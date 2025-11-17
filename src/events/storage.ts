import { TimelineEvent } from './types';
import { COLOR_PALETTE } from '../utils';

/**
 * Serializes events to JSON format for storage.
 */
export function serializeEvents(events: TimelineEvent[]): string {
  const eventsData = events.map((event) => ({
    id: event.id,
    name: event.name,
    startDate: event.startDate.toISOString(),
    endDate: event.endDate ? event.endDate.toISOString() : null,
    color: event.color,
    breaks: event.breaks.map((b) => ({
      startDate: b.startDate.toISOString(),
      endDate: b.endDate.toISOString(),
    })),
  }));
  return JSON.stringify(eventsData);
}

/**
 * Deserializes events from JSON format.
 */
export function deserializeEvents(jsonString: string): TimelineEvent[] {
  const eventsData = JSON.parse(jsonString);
  return eventsData.map((data: any) => ({
    id: data.id,
    name: data.name,
    startDate: new Date(data.startDate),
    endDate: data.endDate ? new Date(data.endDate) : null,
    color: data.color || COLOR_PALETTE[0],
    breaks: data.breaks
      ? data.breaks.map((b: any) => ({
          startDate: new Date(b.startDate),
          endDate: new Date(b.endDate),
        }))
      : [],
  }));
}

/**
 * Saves events to localStorage.
 */
export function saveEventsToLocalStorage(
  events: TimelineEvent[],
  nextId: number,
): void {
  const serialized = serializeEvents(events);
  localStorage.setItem('timelineEvents', serialized);
  localStorage.setItem('timelineNextId', nextId.toString());
}

/**
 * Loads events from localStorage.
 */
export function loadEventsFromLocalStorage(): {
  events: TimelineEvent[];
  nextId: number;
} {
  const storedEvents = localStorage.getItem('timelineEvents');
  const storedNextId = localStorage.getItem('timelineNextId');

  let events: TimelineEvent[] = [];
  let nextId = 1;

  if (storedNextId) {
    nextId = parseInt(storedNextId, 10);
  }

  if (storedEvents) {
    try {
      events = deserializeEvents(storedEvents);
    } catch (error) {
      console.error('Failed to load events from localStorage:', error);
    }
  }

  return { events, nextId };
}

/**
 * Exports events to a JSON file download.
 */
export function exportEventsToFile(events: TimelineEvent[]): void {
  const serialized = serializeEvents(events);
  const dataStr = JSON.stringify(JSON.parse(serialized), null, 2);
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

/**
 * Imports events from a file upload.
 * Returns a promise that resolves with the imported events and the new nextId.
 */
export function importEventsFromFile(): Promise<{
  events: TimelineEvent[];
  nextId: number;
}> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';

    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const jsonString = event.target?.result as string;
          const events = deserializeEvents(jsonString);

          // Calculate nextId to be higher than any imported id
          const maxId = Math.max(...events.map((e) => e.id), 0);
          const nextId = maxId + 1;

          resolve({ events, nextId });
        } catch (error) {
          console.error('Failed to import events:', error);
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    };

    input.click();
  });
}
