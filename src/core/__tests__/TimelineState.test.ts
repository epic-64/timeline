import { TimelineState } from '../TimelineState';
import { TimelineConfig } from '../TimelineConfig';
import { EventRenderer } from '../EventRenderer';
import { EventInteractionHandler } from '../EventInteractionHandler';
import { TimelineEvent } from '../../events';
import * as storage from '../../events/storage';
import * as eventManagement from '../../events/eventManagement';

// Mock only the storage module (has side effects)
jest.mock('../../events/storage');

// Partial mock: only mock functions with side effects, keep pure functions
jest.mock('../../events/eventManagement', () => {
  const actual = jest.requireActual('../../events/eventManagement');
  return {
    ...actual,
    createNewEvent: jest.fn(),
  };
});

describe('TimelineState', () => {
  let container: HTMLElement;
  let datesContainer: HTMLElement;
  let config: TimelineConfig;
  let renderer: EventRenderer;
  let interactionHandler: EventInteractionHandler;
  let state: TimelineState;

  const mockEvents: TimelineEvent[] = [
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
      endDate: null,
      color: '#1b81f0',
      breaks: [],
    },
  ];

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = `
      <div id="timeline-events"></div>
      <div id="timeline-dates"></div>
    `;
    container = document.getElementById('timeline-events')!;
    datesContainer = document.getElementById('timeline-dates')!;

    // Create dependencies
    config = new TimelineConfig(datesContainer);
    renderer = new EventRenderer(container, () => config.getTimelineParams());

    // Create state without handler (no circular dependency!)
    state = new TimelineState(container, config, renderer);

    // Create interaction handler with state as provider
    interactionHandler = new EventInteractionHandler(
      container,
      renderer,
      state, // Pass state as EventStateProvider
      () => config.getTimelineParams(),
      jest.fn(),
    );

    // Wire up interaction handlers (breaks circular dependency)
    state.setInteractionHandlers({
      startResize: jest.fn(),
      toggleColorPicker: jest.fn(),
      changeEventColor: jest.fn(),
      selectEvent: (id) => interactionHandler.selectEvent(id),
      startVerticalReorder: jest.fn(),
    });

    // Mock storage functions
    (storage.loadEventsFromLocalStorage as jest.Mock).mockReturnValue({
      events: [...mockEvents],
      nextId: 3,
    });
    (storage.saveEventsToLocalStorage as jest.Mock).mockImplementation(() => {});
    (storage.exportEventsToFile as jest.Mock).mockImplementation(() => {});

    // Mock event management - only mock functions with side effects
    (eventManagement.createNewEvent as jest.Mock).mockImplementation((id) => ({
      id,
      name: `Event ${id}`,
      startDate: new Date('2022-01-01'),
      endDate: new Date('2023-01-01'),
      color: '#017EFE',
      breaks: [],
    }));
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize state with provided dependencies', () => {
      expect(state).toBeDefined();
      expect(state.getAllEvents()).toEqual([]);
    });
  });

  describe('loadEvents', () => {
    it('should load events from localStorage', () => {
      const renderEventSpy = jest.spyOn(state as any, 'renderEvent');
      
      state.loadEvents();

      expect(storage.loadEventsFromLocalStorage).toHaveBeenCalled();
      expect(renderEventSpy).toHaveBeenCalledTimes(mockEvents.length);
    });

    it('should restore nextId from storage', () => {
      state.loadEvents();
      
      state.addEvent();
      
      expect(eventManagement.createNewEvent).toHaveBeenCalledWith(
        3,
        expect.any(Date),
        expect.any(Date)
      );
    });
  });

  describe('addEvent', () => {
    it('should create and render a new event', () => {
      const renderEventSpy = jest.spyOn(state as any, 'renderEvent');
      
      state.addEvent();

      expect(eventManagement.createNewEvent).toHaveBeenCalled();
      expect(renderEventSpy).toHaveBeenCalledTimes(1);
      expect(storage.saveEventsToLocalStorage).toHaveBeenCalled();
    });

    it('should increment nextId', () => {
      state.loadEvents(); // Sets nextId to 3
      
      state.addEvent();
      expect(eventManagement.createNewEvent).toHaveBeenCalledWith(
        3,
        expect.any(Date),
        expect.any(Date)
      );

      state.addEvent();
      expect(eventManagement.createNewEvent).toHaveBeenCalledWith(
        4,
        expect.any(Date),
        expect.any(Date)
      );
    });
  });

  describe('deleteEvent', () => {
    it('should remove event from DOM and state', () => {
      state.loadEvents();
      
      // Add wrapper to DOM
      container.innerHTML = '<div class="timeline-event-wrapper" data-id="1"></div>';
      
      state.deleteEvent(1);

      expect(container.querySelector('[data-id="1"]')).toBeNull();
      expect(storage.saveEventsToLocalStorage).toHaveBeenCalled();
    });
  });

  describe('toggleEndDate', () => {
    it('should set end date to current month end when null', () => {
      state.loadEvents();
      
      container.innerHTML = '<div class="timeline-event-wrapper" data-id="2"></div>';
      
      state.toggleEndDate(2);

      // Should re-render with end date set
      expect(storage.saveEventsToLocalStorage).toHaveBeenCalled();
    });

    it('should clear end date when set', () => {
      state.loadEvents();
      
      container.innerHTML = '<div class="timeline-event-wrapper" data-id="1"></div>';
      
      state.toggleEndDate(1);

      expect(storage.saveEventsToLocalStorage).toHaveBeenCalled();
    });

    it('should preserve selection state after toggle', () => {
      state.loadEvents();
      interactionHandler.selectEvent(1);
      
      container.innerHTML = `
        <div class="timeline-event-wrapper selected" data-id="1">
          <div class="timeline-event"></div>
        </div>
      `;
      
      state.toggleEndDate(1);

      // After re-render, selection should be restored
      const wrapper = container.querySelector('[data-id="1"]');
      expect(wrapper?.classList.contains('selected')).toBe(true);
    });
  });

  describe('refreshAllEvents', () => {
    it('should update all event positions', () => {
      const updateSpy = jest.spyOn(renderer, 'updateAllEventPositions');
      state.loadEvents();
      
      state.refreshAllEvents();

      expect(updateSpy).toHaveBeenCalledWith(expect.any(Array));
    });
  });

  describe('exportEvents', () => {
    it('should call exportEventsToFile', () => {
      state.loadEvents();
      
      state.exportEvents();

      expect(storage.exportEventsToFile).toHaveBeenCalled();
    });
  });

  describe('reorderEventsFromDOM', () => {
    it('should reorder events array to match DOM', () => {
      state.loadEvents();
      
      container.innerHTML = `
        <div class="timeline-event-wrapper" data-id="2"></div>
        <div class="timeline-event-wrapper" data-id="1"></div>
      `;
      
      // Use the public interface method
      state.reorderEventsFromDOM([2, 1]);

      // Events should now be ordered [2, 1] instead of [1, 2]
      const events = state.getAllEvents();
      expect(events[0].id).toBe(2);
      expect(events[1].id).toBe(1);
    });
  });
});

