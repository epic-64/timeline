import { EventInteractionHandler } from '../EventInteractionHandler';
import { EventRenderer } from '../EventRenderer';
import { TimelineEvent } from '../../events/types';
import { EventStateProvider } from '../EventStateProvider';

describe('EventInteractionHandler', () => {
  let container: HTMLElement;
  let renderer: EventRenderer;
  let handler: EventInteractionHandler;
  let mockGetTimelineParams: jest.Mock;
  let mockOnEventsChange: jest.Mock;
  let mockEvents: TimelineEvent[];
  let mockStateProvider: EventStateProvider;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = '<div id="timeline-events"></div>';
    container = document.getElementById('timeline-events')!;

    // Mock dependencies
    mockGetTimelineParams = jest.fn(() => ({
      timelineStart: new Date('2020-01-01'),
      timelineEnd: new Date('2024-12-31'),
      zoomFactor: 1.5,
    }));

    mockOnEventsChange = jest.fn();

    renderer = new EventRenderer(container, mockGetTimelineParams);

    // Setup mock events
    mockEvents = [
      {
        id: 1,
        name: 'Event 1',
        startDate: new Date('2020-06-01'),
        endDate: new Date('2023-06-01'),
        color: '#017EFE',
        breaks: [],
      },
      {
        id: 2,
        name: 'Event 2',
        startDate: new Date('2021-01-01'),
        endDate: new Date('2022-01-01'),
        color: '#1b81f0',
        breaks: [],
      },
    ];

    // Create mock state provider
    mockStateProvider = {
      getEventById: jest.fn((id: number) => mockEvents.find(e => e.id === id)),
      getAllEvents: jest.fn(() => mockEvents),
      updateEvent: jest.fn((id: number, updates: Partial<TimelineEvent>) => {
        const event = mockEvents.find(e => e.id === id);
        if (event) {
          Object.assign(event, updates);
        }
      }),
      reorderEventsFromDOM: jest.fn(),
    };

    handler = new EventInteractionHandler(
      container,
      renderer,
      mockStateProvider,
      mockGetTimelineParams,
      mockOnEventsChange,
    );
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('selectEvent', () => {
    it('should select an event and deselect previous', () => {
      // Create wrapper elements
      container.innerHTML = `
        <div class="timeline-event-wrapper" data-id="1"></div>
        <div class="timeline-event-wrapper" data-id="2"></div>
      `;

      handler.selectEvent(1);
      expect(container.querySelector('[data-id="1"]')?.classList.contains('selected')).toBe(true);

      handler.selectEvent(2);
      expect(container.querySelector('[data-id="1"]')?.classList.contains('selected')).toBe(false);
      expect(container.querySelector('[data-id="2"]')?.classList.contains('selected')).toBe(true);
    });

    it('should track selected event ID', () => {
      container.innerHTML = '<div class="timeline-event-wrapper" data-id="1"></div>';

      handler.selectEvent(1);
      expect(handler.getSelectedEventId()).toBe(1);
    });
  });

  describe('toggleColorPicker', () => {
    it('should toggle color picker visibility', () => {
      container.innerHTML = `
        <div class="timeline-event-wrapper" data-id="1">
          <div class="color-picker"></div>
        </div>
      `;

      const colorPicker = container.querySelector('.color-picker') as HTMLElement;

      handler.toggleColorPicker(1);
      expect(colorPicker.classList.contains('show')).toBe(true);

      handler.toggleColorPicker(1);
      expect(colorPicker.classList.contains('show')).toBe(false);
    });
  });

  describe('changeEventColor', () => {
    it('should update event color and trigger onChange callback', () => {
      container.innerHTML = `
        <div class="timeline-event-wrapper" data-id="1">
          <div class="timeline-event" data-color="#017EFE"></div>
          <div class="color-picker">
            <div class="color-option" style="background-color: rgb(255, 0, 0)"></div>
          </div>
        </div>
      `;

      handler.changeEventColor(1, '#FF0000');

      expect(mockStateProvider.updateEvent).toHaveBeenCalledWith(1, { color: '#FF0000' });
      expect(mockOnEventsChange).toHaveBeenCalledTimes(1);

      const eventEl = container.querySelector('.timeline-event') as HTMLElement;
      expect(eventEl.dataset.color).toBe('#FF0000');
    });

    it('should handle non-existent event gracefully', () => {
      handler.changeEventColor(999, '#FF0000');
      expect(mockOnEventsChange).not.toHaveBeenCalled();
    });
  });

  describe('startResize', () => {
    it('should initialize resize state', () => {
      const mockEvent = new MouseEvent('mousedown', { clientX: 100, cancelable: true });

      handler.startResize(mockEvent, 1, 'resize-left');

      // Should prevent default
      expect(mockEvent.defaultPrevented).toBe(true);
    });
  });
});

