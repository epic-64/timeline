import {
  createYearMarkers,
  formatDateForInput,
  isValidYear,
  loadTimelineEndDate,
  loadTimelineStartDate,
  saveTimelineEndDate,
  saveTimelineStartYear,
  timeToZoomedPosition
} from '../utils';

/**
 * Manages timeline configuration and date header rendering.
 */
export class TimelineConfig {
  private timelineStart: Date;
  private timelineEnd: Date;
  private readonly zoomFactor = 1.5;

  constructor(private datesContainer: HTMLElement) {
    this.timelineStart = loadTimelineStartDate();
    this.timelineEnd = loadTimelineEndDate();
  }

  /**
   * Initializes the input fields for timeline configuration.
   */
  initializeInputFields(onTimelineChange: () => void): void {
    const startYearInput = document.getElementById(
      'startYear',
    ) as HTMLInputElement;
    const endDateInput = document.getElementById('endDate') as HTMLInputElement;

    if (startYearInput) {
      startYearInput.value = this.timelineStart.getFullYear().toString();
      startYearInput.addEventListener('change', (e) => {
        const year = parseInt((e.target as HTMLInputElement).value);
        if (year && isValidYear(year)) {
          this.timelineStart = new Date(year, 0, 1);
          saveTimelineStartYear(year);
          onTimelineChange();
        }
      });
    }

    if (endDateInput) {
      endDateInput.value = formatDateForInput(this.timelineEnd);
      endDateInput.addEventListener('change', (e) => {
        const dateStr = (e.target as HTMLInputElement).value;
        if (dateStr) {
          this.timelineEnd = new Date(dateStr);
          saveTimelineEndDate(this.timelineEnd);
          onTimelineChange();
        }
      });
    }
  }

  /**
   * Renders the date header with year markers.
   */
  renderDateHeader(): void {
    this.datesContainer.innerHTML = '';
    const startYear = this.timelineStart.getFullYear();
    const endYear = this.timelineEnd.getFullYear();

    const markers = createYearMarkers(startYear, endYear, (yearDate) =>
      timeToZoomedPosition(
        yearDate.getTime(),
        this.timelineStart,
        this.timelineEnd,
        this.zoomFactor,
      ),
    );

    markers.forEach((marker) => this.datesContainer.appendChild(marker));
  }

  getTimelineStart(): Date {
    return this.timelineStart;
  }

  getTimelineEnd(): Date {
    return this.timelineEnd;
  }

  getZoomFactor(): number {
    return this.zoomFactor;
  }

  getTimelineParams() {
    return {
      timelineStart: this.timelineStart,
      timelineEnd: this.timelineEnd,
      zoomFactor: this.zoomFactor,
    };
  }
}
