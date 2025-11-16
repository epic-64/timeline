//TIP With Search Everywhere, you can find any action, file, or symbol in your project. Press <shortcut actionId="Shift"/> <shortcut actionId="Shift"/>, type in <b>terminal</b>, and press <shortcut actionId="EditorEnter"/>. Then run <shortcut raw="npm run dev"/> in the terminal and click the link in its output to open the app in the browser.
interface TimelineEvent {
  id: number;
  name: string;
  startDate: Date;
  endDate: Date;
}

class Timeline {
  private events: TimelineEvent[] = [];
  private nextId = 1;
  private eventsContainer: HTMLElement;
  private datesContainer: HTMLElement;
  private draggedEvent: { id: number; type: 'move' | 'resize-left' | 'resize-right' } | null = null;
  private dragStartX = 0;
  private selectedEventId: number | null = null;

  // Timeline spans 12 months from today
  private timelineStart: Date;
  private timelineEnd: Date;

  constructor() {
    this.eventsContainer = document.getElementById('timeline-events') as HTMLElement;
    this.datesContainer = document.getElementById('timeline-dates') as HTMLElement;

    // Set timeline to span from 2010 to now + 1 year
    this.timelineStart = new Date(2010, 0, 1); // January 1, 2010
    this.timelineEnd = new Date();
    this.timelineEnd.setFullYear(this.timelineEnd.getFullYear() + 1);

    this.setupEventListeners();
    this.renderDateHeader();
  }

  private setupEventListeners() {
    document.getElementById('addEvent')?.addEventListener('click', () => this.addEvent());

    document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    document.addEventListener('mouseup', () => this.handleMouseUp());
    document.addEventListener('click', (e) => this.handleDocumentClick(e));
  }

  private renderDateHeader() {
    this.datesContainer.innerHTML = '';
    const years = [];
    const startYear = this.timelineStart.getFullYear();
    const endYear = this.timelineEnd.getFullYear();

    // Create markers for each year
    for (let year = startYear; year <= endYear; year++) {
      years.push(year);
    }

    years.forEach(year => {
      const dateEl = document.createElement('div');
      dateEl.className = 'timeline-date';
      dateEl.textContent = year.toString();
      this.datesContainer.appendChild(dateEl);
    });
  }

  addEvent() {
    const start = new Date();
    const end = new Date();
    end.setMonth(end.getMonth() + 1);

    const event: TimelineEvent = {
      id: this.nextId++,
      name: `Event ${this.nextId - 1}`,
      startDate: start,
      endDate: end
    };

    this.events.push(event);
    this.renderEvent(event);
  }

  private renderEvent(event: TimelineEvent) {
    const wrapper = document.createElement('div');
    wrapper.className = 'timeline-event-wrapper';
    wrapper.dataset.id = event.id.toString();

    const eventEl = document.createElement('div');
    eventEl.className = 'timeline-event';

    this.updateEventPosition(wrapper, eventEl, event);

    const content = document.createElement('div');
    content.className = 'timeline-event-content';

    const nameEl = document.createElement('span');
    nameEl.className = 'timeline-event-name';
    nameEl.textContent = event.name;
    nameEl.contentEditable = 'true';
    nameEl.addEventListener('blur', (e) => {
      event.name = (e.target as HTMLElement).textContent || event.name;
    });
    nameEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        (e.target as HTMLElement).blur();
      }
    });

    const datesEl = document.createElement('span');
    datesEl.className = 'timeline-event-dates';
    datesEl.textContent = this.formatDateRange(event.startDate, event.endDate);

    content.appendChild(nameEl);
    content.appendChild(datesEl);

    // Resize handles
    const leftHandle = document.createElement('div');
    leftHandle.className = 'timeline-event-handle left';
    leftHandle.addEventListener('mousedown', (e) => this.startResize(e, event.id, 'resize-left'));

    const rightHandle = document.createElement('div');
    rightHandle.className = 'timeline-event-handle right';
    rightHandle.addEventListener('mousedown', (e) => this.startResize(e, event.id, 'resize-right'));

    eventEl.appendChild(leftHandle);
    eventEl.appendChild(content);
    eventEl.appendChild(rightHandle);

    // Delete button (outside the event)
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-button';
    deleteBtn.textContent = '×';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteEvent(event.id);
    });

    wrapper.appendChild(eventEl);
    wrapper.appendChild(deleteBtn);

    // Click to select
    eventEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectEvent(event.id);
    });

    // Drag to move
    content.addEventListener('mousedown', (e) => this.startMove(e, event.id));

    this.eventsContainer.appendChild(wrapper);
  }

  private updateEventPosition(_wrapper: HTMLElement, eventEl: HTMLElement, event: TimelineEvent) {
    const timelineSpan = this.timelineEnd.getTime() - this.timelineStart.getTime();

    const startOffset = event.startDate.getTime() - this.timelineStart.getTime();
    const endOffset = event.endDate.getTime() - this.timelineStart.getTime();

    const leftPercent = (startOffset / timelineSpan) * 100;
    const widthPercent = ((endOffset - startOffset) / timelineSpan) * 100;

    eventEl.style.width = `${Math.max(widthPercent, 5)}%`;
    eventEl.style.marginLeft = `${Math.max(leftPercent, 0)}%`;

    // Update date display
    const datesEl = eventEl.querySelector('.timeline-event-dates');
    if (datesEl) {
      datesEl.textContent = this.formatDateRange(event.startDate, event.endDate);
    }
  }

  private formatDateRange(start: Date, end: Date): string {
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }

  private startMove(e: MouseEvent, id: number) {
    const target = e.target as HTMLElement;

    // Don't start move if clicking on editable name or button
    if (target.contentEditable === 'true' || target.tagName === 'BUTTON') {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    this.draggedEvent = { id, type: 'move' };
    this.dragStartX = e.clientX;

    const wrapper = this.eventsContainer.querySelector(`[data-id="${id}"]`) as HTMLElement;
    const eventEl = wrapper?.querySelector('.timeline-event') as HTMLElement;
    eventEl?.classList.add('dragging');
  }

  private startResize(e: MouseEvent, id: number, type: 'resize-left' | 'resize-right') {
    e.preventDefault();
    e.stopPropagation();

    this.draggedEvent = { id, type };
    this.dragStartX = e.clientX;
  }

  private handleMouseMove(e: MouseEvent) {
    if (!this.draggedEvent) return;

    const event = this.events.find(ev => ev.id === this.draggedEvent!.id);
    if (!event) return;

    const containerWidth = this.eventsContainer.offsetWidth;
    const deltaX = e.clientX - this.dragStartX;
    const timelineSpan = this.timelineEnd.getTime() - this.timelineStart.getTime();
    const deltaTime = (deltaX / containerWidth) * timelineSpan;

    if (this.draggedEvent.type === 'move') {
      const duration = event.endDate.getTime() - event.startDate.getTime();
      event.startDate = new Date(event.startDate.getTime() + deltaTime);
      event.endDate = new Date(event.startDate.getTime() + duration);
    } else if (this.draggedEvent.type === 'resize-left') {
      const newStart = new Date(event.startDate.getTime() + deltaTime);
      if (newStart < event.endDate) {
        event.startDate = newStart;
      }
    } else if (this.draggedEvent.type === 'resize-right') {
      const newEnd = new Date(event.endDate.getTime() + deltaTime);
      if (newEnd > event.startDate) {
        event.endDate = newEnd;
      }
    }

    this.dragStartX = e.clientX;

    const wrapper = this.eventsContainer.querySelector(`[data-id="${this.draggedEvent.id}"]`) as HTMLElement;
    const eventEl = wrapper?.querySelector('.timeline-event') as HTMLElement;
    if (wrapper && eventEl) {
      this.updateEventPosition(wrapper, eventEl, event);
    }
  }

  private handleMouseUp() {
    if (this.draggedEvent) {
      const wrapper = this.eventsContainer.querySelector(`[data-id="${this.draggedEvent.id}"]`) as HTMLElement;
      const eventEl = wrapper?.querySelector('.timeline-event') as HTMLElement;
      eventEl?.classList.remove('dragging');
      this.draggedEvent = null;
    }
  }

  private deleteEvent(id: number) {
    this.events = this.events.filter(e => e.id !== id);
    const wrapper = this.eventsContainer.querySelector(`[data-id="${id}"]`);
    wrapper?.remove();
    if (this.selectedEventId === id) {
      this.selectedEventId = null;
    }
  }

  private selectEvent(id: number) {
    // Deselect previous
    if (this.selectedEventId !== null) {
      const prevWrapper = this.eventsContainer.querySelector(`[data-id="${this.selectedEventId}"]`);
      prevWrapper?.classList.remove('selected');
    }

    // Select new
    this.selectedEventId = id;
    const wrapper = this.eventsContainer.querySelector(`[data-id="${id}"]`);
    wrapper?.classList.add('selected');
  }

  private handleDocumentClick(e: MouseEvent) {
    const target = e.target as HTMLElement;

    // Check if click is outside timeline events
    if (!target.closest('.timeline-event-wrapper')) {
      if (this.selectedEventId !== null) {
        const prevWrapper = this.eventsContainer.querySelector(`[data-id="${this.selectedEventId}"]`);
        prevWrapper?.classList.remove('selected');
        this.selectedEventId = null;
      }
    }
  }
}

// Initialize the timeline
new Timeline();

//TIP To find text strings in your project, you can use the <shortcut actionId="FindInPath"/> shortcut. Press it and type in <b>counter</b> – you’ll get all matches in one place.
//setupCounter(document.getElementById('counter-value') as HTMLElement);

//TIP There's much more in WebStorm to help you be more productive. Press <shortcut actionId="Shift"/> <shortcut actionId="Shift"/> and search for <b>Learn WebStorm</b> to open our learning hub with more things for you to try.
