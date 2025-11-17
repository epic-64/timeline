import { TimelineEvent } from './types';

/**
 * Opens a modal dialog for managing breaks in a timeline event.
 */
export function openBreaksDialog(
  event: TimelineEvent,
  onBreaksChange: () => void,
): void {
  // Create modal backdrop
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  // Create modal dialog
  const dialog = document.createElement('div');
  dialog.className = 'modal-dialog';

  const title = document.createElement('h2');
  title.textContent = `Manage Breaks - ${event.name}`;
  dialog.appendChild(title);

  // Breaks list
  const breaksList = document.createElement('div');
  breaksList.className = 'breaks-list';

  const renderBreaksList = () => {
    breaksList.innerHTML = '';

    if (event.breaks.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.className = 'empty-message';
      emptyMsg.textContent = 'No breaks added yet.';
      breaksList.appendChild(emptyMsg);
    } else {
      event.breaks.forEach((breakPeriod, index) => {
        const breakItem = document.createElement('div');
        breakItem.className = 'break-item';

        const breakInfo = document.createElement('div');
        breakInfo.className = 'break-info';

        const startStr = new Date(breakPeriod.startDate).toLocaleDateString(
          'en-US',
          {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          },
        );
        const endStr = new Date(breakPeriod.endDate).toLocaleDateString(
          'en-US',
          {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          },
        );

        breakInfo.textContent = `${startStr} - ${endStr}`;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'break-delete-btn';
        deleteBtn.textContent = '×';
        deleteBtn.addEventListener('click', () => {
          event.breaks.splice(index, 1);
          renderBreaksList();
          onBreaksChange();
        });

        breakItem.appendChild(breakInfo);
        breakItem.appendChild(deleteBtn);
        breaksList.appendChild(breakItem);
      });
    }
  };

  renderBreaksList();
  dialog.appendChild(breaksList);

  // Add break form
  const addBreakForm = createAddBreakForm(event, () => {
    renderBreaksList();
    onBreaksChange();
  });
  dialog.appendChild(addBreakForm);

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.className = 'modal-close-btn';
  closeBtn.addEventListener('click', () => {
    backdrop.remove();
  });
  dialog.appendChild(closeBtn);

  backdrop.appendChild(dialog);
  document.body.appendChild(backdrop);

  // Close on backdrop click
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      backdrop.remove();
    }
  });
}

/**
 * Creates the form for adding a new break.
 */
function createAddBreakForm(
  event: TimelineEvent,
  onBreakAdded: () => void,
): HTMLElement {
  const addBreakForm = document.createElement('div');
  addBreakForm.className = 'add-break-form';

  const formTitle = document.createElement('h3');
  formTitle.textContent = 'Add New Break';
  addBreakForm.appendChild(formTitle);

  const startLabel = document.createElement('label');
  startLabel.textContent = 'Start Date:';
  const startInput = document.createElement('input');
  startInput.type = 'date';
  startInput.className = 'break-date-input';
  startLabel.appendChild(startInput);

  const endLabel = document.createElement('label');
  endLabel.textContent = 'End Date:';
  const endInput = document.createElement('input');
  endInput.type = 'date';
  endInput.className = 'break-date-input';
  endLabel.appendChild(endInput);

  const addBtn = document.createElement('button');
  addBtn.textContent = 'Add Break';
  addBtn.className = 'add-break-btn';
  addBtn.addEventListener('click', () => {
    const startDate = startInput.value;
    const endDate = endInput.value;

    if (!startDate || !endDate) {
      alert('Please enter both start and end dates.');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      alert('End date must be after start date.');
      return;
    }

    // Validate that break is within event period
    const eventEnd = event.endDate || new Date();
    if (start < event.startDate || end > eventEnd) {
      alert('Break must be within the event period.');
      return;
    }

    event.breaks.push({ startDate: start, endDate: end });

    // Sort breaks by start date
    event.breaks.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    onBreakAdded();

    // Clear inputs
    startInput.value = '';
    endInput.value = '';
  });

  addBreakForm.appendChild(startLabel);
  addBreakForm.appendChild(endLabel);
  addBreakForm.appendChild(addBtn);

  return addBreakForm;
}

