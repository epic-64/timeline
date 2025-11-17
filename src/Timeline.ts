import { EventInteractionHandler, EventRenderer, TimelineConfig, TimelineState } from './core';

/**
 * Main Timeline class - coordinates between components using composition.
 */
export class Timeline {
  private readonly config: TimelineConfig;
  private readonly renderer: EventRenderer;
  private readonly interactionHandler: EventInteractionHandler;
  private state: TimelineState;

  constructor() {
    const eventsContainer = document.getElementById(
      'timeline-events',
    ) as HTMLElement;
    const datesContainer = document.getElementById(
      'timeline-dates',
    ) as HTMLElement;

    // Initialize components
    this.config = new TimelineConfig(datesContainer);

    this.renderer = new EventRenderer(eventsContainer, () =>
      this.config.getTimelineParams(),
    );

    // Create state without handler (no circular dependency!)
    this.state = new TimelineState(
      eventsContainer,
      this.config,
      this.renderer,
    );

    // Create interaction handler with state as provider
    this.interactionHandler = new EventInteractionHandler(
      eventsContainer,
      this.renderer,
      this.state, // Pass state as EventStateProvider
      () => this.config.getTimelineParams(),
      () => {}, // Will be handled by TimelineState through updateEvent
    );

    // Wire up interaction handlers (breaks circular dependency)
    this.state.setInteractionHandlers({
      startResize: (e, id, type) => this.interactionHandler.startResize(e, id, type),
      toggleColorPicker: (id) => this.interactionHandler.toggleColorPicker(id),
      changeEventColor: (id, color) => this.interactionHandler.changeEventColor(id, color),
      selectEvent: (id) => this.interactionHandler.selectEvent(id),
      startVerticalReorder: (e, id) => this.interactionHandler.startVerticalReorder(e, id),
    });

    // Setup and initialize
    this.setupEventListeners();
    this.config.initializeInputFields(() => this.refreshTimeline());
    this.config.renderDateHeader();
    this.state.loadEvents();
  }

  private setupEventListeners(): void {
    document
      .getElementById('addEvent')
      ?.addEventListener('click', () => this.state.addEvent());
    document
      .getElementById('exportEvents')
      ?.addEventListener('click', () => this.state.exportEvents());
    document
      .getElementById('importEvents')
      ?.addEventListener('click', () => this.state.importEvents());
    document
      .getElementById('downloadImage')
      ?.addEventListener('click', () => this.state.downloadAsImage());
  }

  private refreshTimeline(): void {
    this.config.renderDateHeader();
    this.state.refreshAllEvents();
  }
}
