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

    // Create state first (without handler reference)
    this.state = new TimelineState(
      eventsContainer,
      this.config,
      this.renderer,
      null as any, // Will be set after handler is created
    );

    // Create interaction handler with state as provider
    this.interactionHandler = new EventInteractionHandler(
      eventsContainer,
      this.renderer,
      this.state, // Pass state as EventStateProvider
      () => this.config.getTimelineParams(),
      () => {}, // Will be handled by TimelineState through updateEvent
    );

    // Wire up the interaction handler in state
    (this.state as any).interactionHandler = this.interactionHandler;

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
