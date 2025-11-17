import html2canvas from 'html2canvas';

/**
 * Downloads the timeline as a PNG image.
 */
export async function downloadTimelineAsImage(
  containerSelector: string,
  selectedEventId: number | null,
): Promise<void> {
  const timelineContainer = document.querySelector(
    containerSelector,
  ) as HTMLElement;

  if (!timelineContainer) {
    alert('Timeline not found!');
    return;
  }

  try {
    // Hide UI elements that shouldn't be in the image
    const elementsToHide = timelineContainer.querySelectorAll(
      '.delete-button, .color-button, .clear-end-button, .color-picker, .timeline-event-handle, .breaks-button',
    );
    elementsToHide.forEach(
      (el) => ((el as HTMLElement).style.display = 'none'),
    );

    // Remove selected state temporarily
    const selectedElements = timelineContainer.querySelectorAll('.selected');
    selectedElements.forEach((el) => el.classList.remove('selected'));

    // Capture the timeline
    const canvas = await html2canvas(timelineContainer, {
      backgroundColor: '#000000',
      scale: 2, // Higher resolution
      logging: false,
      useCORS: true,
    });

    // Restore hidden elements
    elementsToHide.forEach((el) => ((el as HTMLElement).style.display = ''));

    // Restore selected state
    if (selectedEventId !== null) {
      const wrapper = document.querySelector(`[data-id="${selectedEventId}"]`);
      wrapper?.classList.add('selected');
    }

    // Convert canvas to blob and download
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `timeline-${new Date().toISOString().split('T')[0]}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    }, 'image/png');
  } catch (error) {
    console.error('Failed to download image:', error);
    alert('Failed to download image. Please try again.');

    // Restore hidden elements in case of error
    const elementsToHide = timelineContainer.querySelectorAll(
      '.delete-button, .color-button, .clear-end-button, .color-picker, .timeline-event-handle, .breaks-button',
    );
    elementsToHide.forEach((el) => ((el as HTMLElement).style.display = ''));

    // Restore selected state
    if (selectedEventId !== null) {
      const wrapper = document.querySelector(`[data-id="${selectedEventId}"]`);
      wrapper?.classList.add('selected');
    }
  }
}
