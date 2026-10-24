(function () {
  function ensureDialog() {
    let dialog = document.querySelector('[data-featured-event-dialog]');
    if (dialog) return dialog;

    dialog = document.createElement('dialog');
    dialog.className = 'featured-event-dialog';
    dialog.dataset.featuredEventDialog = '';
    dialog.innerHTML = `
      <div class="featured-event-dialog-inner">
        <h2 data-featured-event-dialog-title>Event details</h2>
        <div class="featured-event-dialog-description" data-featured-event-dialog-description></div>
        <div class="featured-event-dialog-actions">
          <button type="button" class="button" data-featured-event-dialog-close>Close</button>
        </div>
      </div>`;

    dialog.querySelector('[data-featured-event-dialog-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    document.body.appendChild(dialog);
    return dialog;
  }

  function positionScheduleLink(target) {
    const content = target.querySelector('.featured-event-content');
    const meta = content?.querySelector('.event-meta');
    if (!content || !meta) return false;

    const link = Array.from(target.querySelectorAll('.event-actions a')).find((candidate) =>
      candidate.textContent.trim().toLowerCase() === 'event details'
    ) || target.querySelector('.featured-event-schedule-link');

    if (!link) return false;

    link.classList.remove('button', 'button-primary');
    link.classList.add('featured-event-schedule-link');
    if (link.textContent.trim() !== 'Event details') link.textContent = 'Event details';

    if (link.parentElement !== content || link.nextElementSibling !== meta) {
      content.insertBefore(link, meta);
    }

    const actions = content.querySelector('.event-actions');
    if (actions && !actions.children.length) actions.remove();
    return true;
  }

  function applyClamp(target) {
    const description = target.querySelector('.featured-event-description');
    const title = target.querySelector('#featured-heading');
    if (!description || !title || description.hidden) return false;

    description.classList.remove('is-overflowing');

    requestAnimationFrame(() => {
      const existingLink = target.querySelector('.featured-event-details-link');
      const overflowing = description.scrollHeight > description.clientHeight + 1;
      if (!overflowing) {
        existingLink?.remove();
        return;
      }

      description.classList.add('is-overflowing');
      if (existingLink) return;

      const link = document.createElement('button');
      link.type = 'button';
      link.className = 'featured-event-details-link';
      link.textContent = 'Event details →';
      link.setAttribute('aria-haspopup', 'dialog');
      link.addEventListener('click', () => {
        const dialog = ensureDialog();
        dialog.querySelector('[data-featured-event-dialog-title]').textContent = title.textContent.trim() || 'Event details';
        dialog.querySelector('[data-featured-event-dialog-description]').textContent = description.textContent.trim();
        dialog.showModal();
      });

      description.insertAdjacentElement('afterend', link);
    });

    return true;
  }

  function init() {
    const target = document.querySelector('[data-featured-event]');
    if (!target) return;

    let resizeTimer;
    let observer;

    const enhance = () => {
      const positioned = positionScheduleLink(target);
      const clamped = applyClamp(target);

      if (positioned || clamped) {
        observer?.disconnect();
        observer = null;
      }
    };

    observer = new MutationObserver(enhance);
    observer.observe(target, { childList: true, subtree: true, characterData: true });

    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => applyClamp(target), 120);
    });

    enhance();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
