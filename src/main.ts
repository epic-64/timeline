//TIP With Search Everywhere, you can find any action, file, or symbol in your project. Press <shortcut actionId="Shift"/> <shortcut actionId="Shift"/>, type in <b>terminal</b>, and press <shortcut actionId="EditorEnter"/>. Then run <shortcut raw="npm run dev"/> in the terminal and click the link in its output to open the app in the browser.
interface TimelineEvent {
  id: number;
  name: string;
  startDate: Date;
  endDate: Date | null;
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
    this.loadEvents();
  }

  private setupEventListeners() {
    document.getElementById('addEvent')?.addEventListener('click', () => this.addEvent());
    document.getElementById('exportEvents')?.addEventListener('click', () => this.exportEvents());
    document.getElementById('importEvents')?.addEventListener('click', () => this.importEvents());

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
    this.saveEvents();
  }

  private renderEvent(event: TimelineEvent) {
    const wrapper = document.createElement('div');
    wrapper.className = 'timeline-event-wrapper';
    wrapper.dataset.id = event.id.toString();

    const eventEl = document.createElement('div');
    eventEl.className = 'timeline-event';

    // Mark as open-ended if no end date
    if (event.endDate === null) {
      eventEl.classList.add('open-ended');
    }

    this.updateEventPosition(wrapper, eventEl, event);

    const content = document.createElement('div');
    content.className = 'timeline-event-content';

    const nameEl = document.createElement('span');
    nameEl.className = 'timeline-event-name';
    nameEl.textContent = event.name;
    nameEl.contentEditable = 'true';
    nameEl.addEventListener('blur', (e) => {
      event.name = (e.target as HTMLElement).textContent || event.name;
      this.saveEvents();
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

    // Clear end date button
    const clearEndBtn = document.createElement('button');
    clearEndBtn.className = 'clear-end-button';
    clearEndBtn.textContent = event.endDate === null ? '📅' : '∞';
    clearEndBtn.title = event.endDate === null ? 'Set End Date' : 'Clear End Date (Ongoing)';
    clearEndBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleEndDate(event.id);
    });

    // Delete button (outside the event)
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-button';
    deleteBtn.textContent = '×';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteEvent(event.id);
    });

    wrapper.appendChild(eventEl);
    wrapper.appendChild(clearEndBtn);
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
    // If no end date, use today's date for visualization
    const effectiveEndDate = event.endDate || new Date();
    const endOffset = effectiveEndDate.getTime() - this.timelineStart.getTime();

    const leftPercent = (startOffset / timelineSpan) * 100;
    const widthPercent = ((endOffset - startOffset) / timelineSpan) * 100;

    eventEl.style.width = `${Math.max(widthPercent, 5)}%`;
    eventEl.style.marginLeft = `${Math.max(leftPercent, 0)}%`;

    // Update or add open-ended class
    if (event.endDate === null) {
      eventEl.classList.add('open-ended');
    } else {
      eventEl.classList.remove('open-ended');
    }

    // Update date display
    const datesEl = eventEl.querySelector('.timeline-event-dates');
    if (datesEl) {
      datesEl.textContent = this.formatDateRange(event.startDate, event.endDate);
    }
  }

  private formatDateRange(start: Date, end: Date | null): string {
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (end === null) {
      return `${startStr} - Present`;
    }
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startStr} - ${endStr}`;
  }

  private snapToStartOfMonth(date: Date): Date {
    const snapped = new Date(date);
    snapped.setDate(1);
    snapped.setHours(0, 0, 0, 0);
    return snapped;
  }

  private snapToEndOfMonth(date: Date): Date {
    const snapped = new Date(date);
    // Go to next month, then back one day
    snapped.setMonth(snapped.getMonth() + 1);
    snapped.setDate(0);
    snapped.setHours(23, 59, 59, 999);
    return snapped;
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
      // Only move if event has an end date
      if (event.endDate !== null) {
        const duration = event.endDate.getTime() - event.startDate.getTime();
        event.startDate = new Date(event.startDate.getTime() + deltaTime);
        event.endDate = new Date(event.startDate.getTime() + duration);
      } else {
        // For open-ended events, only move the start date
        event.startDate = new Date(event.startDate.getTime() + deltaTime);
      }
    } else if (this.draggedEvent.type === 'resize-left') {
      const newStart = new Date(event.startDate.getTime() + deltaTime);
      const compareDate = event.endDate || new Date();
      if (newStart < compareDate) {
        event.startDate = newStart;
      }
    } else if (this.draggedEvent.type === 'resize-right') {
      // Can't resize right handle if no end date
      if (event.endDate !== null) {
        const newEnd = new Date(event.endDate.getTime() + deltaTime);
        if (newEnd > event.startDate) {
          event.endDate = newEnd;
        }
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
      const event = this.events.find(ev => ev.id === this.draggedEvent!.id);

      if (event) {
        // Apply snapping based on drag type
        if (this.draggedEvent.type === 'resize-left' || this.draggedEvent.type === 'move') {
          // Snap start date to beginning of month
          event.startDate = this.snapToStartOfMonth(event.startDate);
        }

        if (event.endDate !== null && (this.draggedEvent.type === 'resize-right' || this.draggedEvent.type === 'move')) {
          // Snap end date to end of month (only if end date exists)
          event.endDate = this.snapToEndOfMonth(event.endDate);
        }

        // Ensure start is before end after snapping (only if end date exists)
        if (event.endDate !== null && event.startDate >= event.endDate) {
          // If snapping caused overlap, adjust end date to end of start date's month
          event.endDate = this.snapToEndOfMonth(event.startDate);
        }

        // Update the visual position after snapping
        const wrapper = this.eventsContainer.querySelector(`[data-id="${this.draggedEvent.id}"]`) as HTMLElement;
        const eventEl = wrapper?.querySelector('.timeline-event') as HTMLElement;
        if (wrapper && eventEl) {
          this.updateEventPosition(wrapper, eventEl, event);
        }
      }

      const wrapper = this.eventsContainer.querySelector(`[data-id="${this.draggedEvent.id}"]`) as HTMLElement;
      const eventEl = wrapper?.querySelector('.timeline-event') as HTMLElement;
      eventEl?.classList.remove('dragging');
      this.draggedEvent = null;
      this.saveEvents();
    }
  }

  private deleteEvent(id: number) {
    this.events = this.events.filter(e => e.id !== id);
    const wrapper = this.eventsContainer.querySelector(`[data-id="${id}"]`);
    wrapper?.remove();
    if (this.selectedEventId === id) {
      this.selectedEventId = null;
    }
    this.saveEvents();
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

  private toggleEndDate(id: number) {
    const event = this.events.find(e => e.id === id);
    if (!event) return;

    if (event.endDate === null) {
      // Set end date to end of current month
      event.endDate = this.snapToEndOfMonth(new Date());
    } else {
      // Clear end date
      event.endDate = null;
    }

    // Re-render the event
    const wrapper = this.eventsContainer.querySelector(`[data-id="${id}"]`);
    if (wrapper) {
      wrapper.remove();
      this.renderEvent(event);

      // Restore selection if it was selected
      if (this.selectedEventId === id) {
        const newWrapper = this.eventsContainer.querySelector(`[data-id="${id}"]`);
        newWrapper?.classList.add('selected');
      }
    }

    this.saveEvents();
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

  private saveEvents() {
    const eventsData = this.events.map(event => ({
      id: event.id,
      name: event.name,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate ? event.endDate.toISOString() : null
    }));
    localStorage.setItem('timelineEvents', JSON.stringify(eventsData));
    localStorage.setItem('timelineNextId', this.nextId.toString());
  }

  private loadEvents() {
    const storedEvents = localStorage.getItem('timelineEvents');
    const storedNextId = localStorage.getItem('timelineNextId');

    if (storedNextId) {
      this.nextId = parseInt(storedNextId, 10);
    }

    if (storedEvents) {
      try {
        const eventsData = JSON.parse(storedEvents);
        this.events = eventsData.map((data: any) => ({
          id: data.id,
          name: data.name,
          startDate: new Date(data.startDate),
          endDate: data.endDate ? new Date(data.endDate) : null
        }));

        // Render all loaded events
        this.events.forEach(event => this.renderEvent(event));
      } catch (error) {
        console.error('Failed to load events from localStorage:', error);
      }
    }
  }

  private exportEvents() {
    const eventsData = this.events.map(event => ({
      id: event.id,
      name: event.name,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate ? event.endDate.toISOString() : null
    }));

    const dataStr = JSON.stringify(eventsData, null, 2);
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

  private importEvents() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';

    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const eventsData = JSON.parse(event.target?.result as string);

          // Clear existing events
          this.eventsContainer.innerHTML = '';
          this.events = [];

          // Import new events
          eventsData.forEach((data: any) => {
            const event: TimelineEvent = {
              id: data.id,
              name: data.name,
              startDate: new Date(data.startDate),
              endDate: data.endDate ? new Date(data.endDate) : null
            };
            this.events.push(event);
            this.renderEvent(event);
          });

          // Update nextId to be higher than any imported id
          const maxId = Math.max(...this.events.map(e => e.id), 0);
          this.nextId = maxId + 1;

          this.saveEvents();
          alert('Events imported successfully!');
        } catch (error) {
          console.error('Failed to import events:', error);
          alert('Failed to import events. Please check the file format.');
        }
      };
      reader.readAsText(file);
    };

    input.click();
  }
}

// Initialize the timeline
new Timeline();

//TIP To find text strings in your project, you can use the <shortcut actionId="FindInPath"/> shortcut. Press it and type in <b>counter</b> – you’ll get all matches in one place.
//setupCounter(document.getElementById('counter-value') as HTMLElement);

//TIP There's much more in WebStorm to help you be more productive. Press <shortcut actionId="Shift"/> <shortcut actionId="Shift"/> and search for <b>Learn WebStorm</b> to open our learning hub with more things for you to try.
